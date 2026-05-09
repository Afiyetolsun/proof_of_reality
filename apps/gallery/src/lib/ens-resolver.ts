/**
 * Authoritative scan enumeration straight from the RealityENSResolver
 * contract on Eth Sepolia. The contract emits one ProofPublished event
 * per setProof call and stores the full Proof struct in proofs(node);
 * together that's everything the gallery card needs (attestor,
 * contenthash, tokenId, bundleHash, mode, capturedAt, sceneCid).
 *
 * Why this exists alongside ens-subgraph.ts:
 *   - The third-party ENS Sepolia subgraph lags / drops entries; chasing
 *     it has caused freshly-minted scans to vanish from the grid.
 *   - The resolver IS the source of truth for "what scans we've published".
 *     A subname without setProof isn't a real scan.
 *   - Subgraph stays as a fallback ONLY for label-string recovery on
 *     user-supplied subnames (the deterministic vin- labels we
 *     reconstruct locally from bundleHash, no RPC needed).
 */
import {
  createPublicClient,
  http,
  namehash,
  parseAbiItem,
  type Address,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";
import { RealityENSResolverAbi } from "@proof-of-reality/contracts-abi";
import { decodeContenthash } from "./contenthash";
import { lookupLabelsByNode } from "./ens-subgraph";
import type { SubnameRecord } from "./ens-records";

const RPC_URL =
  process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC ??
  "https://ethereum-sepolia-rpc.publicnode.com";

const PARENT_NAME = process.env.NEXT_PUBLIC_ENS_PARENT_NAME ?? "realityproof.eth";

/**
 * Default to the deployed RealityENSResolver on Eth Sepolia
 * (docs/private/deployments.md). The address is public + stable and
 * baking it in lets the gallery enumerate from the contract without
 * requiring every deployer to set NEXT_PUBLIC_ENS_RESOLVER_ADDRESS.
 * Override the env if you redeploy the resolver.
 */
const RESOLVER_ADDRESS = (process.env.NEXT_PUBLIC_ENS_RESOLVER_ADDRESS ??
  "0xF7ce9F50EBc3CDdC1C5Bfab76f6Bead512361493") as Address;

/**
 * Optional lower bound for the ProofPublished log scan. First event
 * landed at Eth Sepolia block 10_817_280 (2026-05-09); the default
 * below sits a few k blocks earlier so we cover the resolver's full
 * history without paying for hundreds of empty chunks. Override via
 * env if you redeploy the resolver further back.
 */
const FROM_BLOCK_RAW = process.env.NEXT_PUBLIC_ENS_RESOLVER_FROM_BLOCK;
const FROM_BLOCK = FROM_BLOCK_RAW ? BigInt(FROM_BLOCK_RAW) : 10_800_000n;

/**
 * Most public Sepolia RPCs (publicnode, ankr, etc.) cap eth_getLogs at
 * 10k–50k blocks per request. 9_000 is well under all known caps and
 * keeps the chunk count reasonable for a few months of history.
 */
const LOG_CHUNK_SIZE = 9_000n;

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;

const PROOF_PUBLISHED = parseAbiItem(
  "event ProofPublished(bytes32 indexed node, uint256 indexed tokenId, bytes32 bundleHash, address attestor)",
);

const MODE_NAMES = ["roomPlan", "objectCapture", "stereoFusion"] as const;

const client = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL, { batch: true }),
});

export function isResolverConfigured(): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(RESOLVER_ADDRESS);
}

/**
 * Returns one record per (latest) ProofPublished event. setProof is
 * idempotent — overwrites — so we keep the last event per node.
 */
export async function listProofsFromResolver(): Promise<SubnameRecord[]> {

  const latestBlock = await client.getBlockNumber();
  const logs = await getLogsChunked(RESOLVER_ADDRESS, FROM_BLOCK, latestBlock);

  // Dedup by node, keeping the latest event (highest blockNumber, then logIndex).
  const latestByNode = new Map<Hex, (typeof logs)[number]>();
  for (const log of logs) {
    const node = log.args.node;
    if (!node) continue;
    const prev = latestByNode.get(node);
    if (
      !prev ||
      log.blockNumber > prev.blockNumber ||
      (log.blockNumber === prev.blockNumber && log.logIndex > prev.logIndex)
    ) {
      latestByNode.set(node, log);
    }
  }

  const nodes = [...latestByNode.keys()];
  if (nodes.length === 0) return [];

  const proofResults = await client.multicall({
    contracts: nodes.map((node) => ({
      address: RESOLVER_ADDRESS,
      abi: RealityENSResolverAbi,
      functionName: "proofs" as const,
      args: [node] as const,
    })),
    allowFailure: true,
  });

  const records: SubnameRecord[] = [];
  const unknownNodes: Hex[] = [];
  const stagedByNode = new Map<Hex, SubnameRecord>();

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const r = proofResults[i];
    if (!r || r.status !== "success" || !r.result) continue;

    // viem returns tuple-style outputs as positional arrays for
    // unnamed-output public mappings, but the generated ABI here has
    // named outputs so the result is a tuple of values in declaration
    // order. Unpack defensively.
    const tuple = r.result as readonly [
      Address, // attestor
      Hex,     // bundleHash
      Hex,     // contenthash
      string,  // satSig
      string,  // cosmoSig
      string,  // sceneCid
      bigint,  // capturedAt
      bigint,  // tokenId
      number,  // mode
    ];
    const [attestor, bundleHash, contenthashHex, , , , capturedAt, tokenId, mode] =
      tuple;

    const labelInfo = deriveDefaultLabel(bundleHash, node);
    const record: SubnameRecord = {
      name: labelInfo?.name ?? "",
      labelName: labelInfo?.label ?? "",
      // Use capturedAt for sort/display — that's the scan time, which is
      // what the user cares about. Falls back to 0 only if the proof
      // happens to lack a capturedAt (shouldn't, but guard anyway).
      createdAt: Number(capturedAt) || 0,
      attestor: attestor === ZERO_ADDR ? null : attestor,
      content: decodeContenthash(contenthashHex),
      tokenId,
      bundleHash,
      mode: MODE_NAMES[mode] ?? null,
      capturedAt: Number(capturedAt) || null,
      description: null,
    };

    if (!labelInfo) unknownNodes.push(node);
    stagedByNode.set(node, record);
    records.push(record);
  }

  // Best-effort label recovery for user-supplied subnames. If the
  // subgraph is down we fall back to a node-fingerprint stub so the
  // card still renders.
  if (unknownNodes.length > 0) {
    let labelMap = new Map<Hex, { name: string; labelName: string }>();
    try {
      labelMap = await lookupLabelsByNode(unknownNodes);
    } catch {
      // swallow — handled below
    }
    for (const node of unknownNodes) {
      const r = stagedByNode.get(node);
      if (!r) continue;
      const found = labelMap.get(node);
      if (found) {
        r.name = found.name;
        r.labelName = found.labelName;
      } else {
        const stub = `node-${node.slice(2, 10)}`;
        r.labelName = stub;
        r.name = `${stub}.${PARENT_NAME}`;
      }
    }
  }

  return records;
}

/**
 * Chunked eth_getLogs scan — works around the 10k–50k per-request
 * block cap on public Sepolia RPCs. Walks forward in LOG_CHUNK_SIZE
 * windows; each window is independent so we run them in parallel.
 */
async function getLogsChunked(address: Address, from: bigint, to: bigint) {
  if (to < from) return [];
  const ranges: Array<[bigint, bigint]> = [];
  for (let start = from; start <= to; start += LOG_CHUNK_SIZE) {
    const end = start + LOG_CHUNK_SIZE - 1n > to ? to : start + LOG_CHUNK_SIZE - 1n;
    ranges.push([start, end]);
  }
  const chunks = await Promise.all(
    ranges.map(([start, end]) =>
      client.getLogs({
        address,
        event: PROOF_PUBLISHED,
        fromBlock: start,
        toBlock: end,
      }),
    ),
  );
  return chunks.flat();
}

/**
 * Reconstruct the deterministic `vin-<bundleHash[2:14]>` label and
 * confirm by recomputing the namehash. Returns null when the on-chain
 * node corresponds to a user-supplied label we can't derive.
 */
function deriveDefaultLabel(
  bundleHash: Hex,
  node: Hex,
): { label: string; name: string } | null {
  const slug = bundleHash.replace(/^0x/, "").slice(0, 12).toLowerCase();
  const label = `vin-${slug}`;
  const name = `${label}.${PARENT_NAME}`;
  if (namehash(name).toLowerCase() === node.toLowerCase()) {
    return { label, name };
  }
  return null;
}
