/**
 * Batch-read text records for a list of subnames in one multicall. The
 * ENS subgraph stores which TEXT keys have been set on a resolver, but
 * not the values. We hit the resolver contract directly via viem's
 * multicall to fan out one RPC call per N (subnames × keys).
 *
 * Keys we care about for gallery cards:
 *   tokenId, bundleHash, mode, capturedAt, description
 *
 * We skip satSig/cosmoSig — those are 130+ char hex strings, not useful
 * on a card-sized surface, and the per-name viewer page already reads
 * them.
 */
import { createPublicClient, http, namehash, type Address, type Hex } from "viem";
import { sepolia } from "viem/chains";
import { decodeContenthash, type ContentRef } from "./contenthash";
import type { SubgraphSubname } from "./ens-subgraph";

const RPC_URL =
  process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC ??
  "https://ethereum-sepolia-rpc.publicnode.com";

const RESOLVER_ABI = [
  {
    type: "function",
    name: "text",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
    ],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

const TEXT_KEYS = ["tokenId", "bundleHash", "mode", "capturedAt", "description"] as const;
type TextKey = (typeof TEXT_KEYS)[number];

const client = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL, { batch: true }),
});

export interface SubnameRecord {
  name: string;
  labelName: string;
  createdAt: number;
  attestor: Address | null;
  content: ContentRef | null;
  tokenId: bigint | null;
  bundleHash: Hex | null;
  mode: string | null;
  capturedAt: number | null;
  description: string | null;
}

/**
 * Hydrate a list of subgraph rows with their on-chain TEXT records.
 * Errors per-subname are swallowed (we still emit the subname with
 * null fields) so a partially-broken record doesn't blank the gallery.
 */
export async function hydrateRecords(
  subnames: SubgraphSubname[],
): Promise<SubnameRecord[]> {
  if (subnames.length === 0) return [];

  // Build a flat call array: one per (subname, key). multicall returns
  // results in the same order, which we then unflatten back into rows.
  const calls = subnames.flatMap((s) => {
    if (!s.resolverAddress) return [];
    const node = namehash(s.name);
    return TEXT_KEYS.map((key) => ({
      address: s.resolverAddress as Address,
      abi: RESOLVER_ABI,
      functionName: "text" as const,
      args: [node, key] as const,
    }));
  });

  let results: Array<{ status: "success" | "failure"; result?: unknown }> = [];
  if (calls.length > 0) {
    try {
      results = (await client.multicall({
        contracts: calls,
        allowFailure: true,
      })) as typeof results;
    } catch {
      results = calls.map(() => ({ status: "failure" }));
    }
  }

  const out: SubnameRecord[] = [];
  let cursor = 0;
  for (const s of subnames) {
    if (!s.resolverAddress) {
      out.push({
        name: s.name,
        labelName: s.labelName,
        createdAt: s.createdAt,
        attestor: s.resolvedAddress,
        content: decodeContenthash(s.contentHash),
        tokenId: null,
        bundleHash: null,
        mode: null,
        capturedAt: null,
        description: null,
      });
      continue;
    }
    const slice = results.slice(cursor, cursor + TEXT_KEYS.length);
    cursor += TEXT_KEYS.length;
    const text: Partial<Record<TextKey, string>> = {};
    TEXT_KEYS.forEach((key, i) => {
      const r = slice[i];
      if (r?.status === "success" && typeof r.result === "string" && r.result !== "") {
        text[key] = r.result;
      }
    });

    out.push({
      name: s.name,
      labelName: s.labelName,
      createdAt: s.createdAt,
      attestor: s.resolvedAddress,
      content: decodeContenthash(s.contentHash),
      tokenId: text.tokenId ? safeBigInt(text.tokenId) : null,
      bundleHash: text.bundleHash ? (text.bundleHash as Hex) : null,
      mode: text.mode ?? null,
      capturedAt: text.capturedAt ? Number(text.capturedAt) || null : null,
      description: text.description ?? null,
    });
  }
  return out;
}

function safeBigInt(s: string): bigint | null {
  try {
    return BigInt(s);
  } catch {
    return null;
  }
}
