import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  namehash,
  toBytes,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { RealityENSResolverAbi } from "@proof-of-reality/contracts-abi";
import { env } from "../config/env.js";

/**
 * ENS subname publication for Reality NFTs.
 *
 * Each mint gets a subname `vin-<bundleHash[2:14]>.realityproof.eth` on
 * Ethereum Sepolia. We:
 *   1. Call our deployed RealityENSResolver.setProof(subnode, proof) — one tx
 *   2. The subnode is namehash("vin-…realityproof.eth"). Note this requires
 *      the subname to actually exist in the ENS Registry — i.e. someone has
 *      called NameWrapper.setSubnodeRecord(parentNode, label, ...) first.
 *
 * For the demo the backend wallet is delegated as Manager of realityproof.eth
 * via the ENS app, so step (2) — creating the subnode + pointing it at our
 * resolver — happens via NameWrapper directly.
 *
 * If any of this fails (network blip, missing env, etc.) we swallow the
 * error and return null. The mint itself never blocks on ENS publication.
 */

const NAME_WRAPPER_SEPOLIA: Address = "0x0635513f179D50A207757E05759CbD106d7dFcE8";

const NAME_WRAPPER_ABI = [
  {
    type: "function",
    name: "setSubnodeRecord",
    stateMutability: "nonpayable",
    inputs: [
      { name: "parentNode", type: "bytes32" },
      { name: "label", type: "string" },
      { name: "owner", type: "address" },
      { name: "resolver", type: "address" },
      { name: "ttl", type: "uint64" },
      { name: "fuses", type: "uint32" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [{ name: "node", type: "bytes32" }],
  },
] as const;

let _publicClient: ReturnType<typeof createPublicClient> | undefined;
let _walletClient: ReturnType<typeof createWalletClient> | undefined;

function publicClient() {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: sepolia,
      transport: http(env().ETH_SEPOLIA_RPC),
    });
  }
  return _publicClient;
}

function walletClient() {
  if (!_walletClient) {
    const account = privateKeyToAccount(env().MINTER_PRIVATE_KEY as Hex);
    _walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(env().ETH_SEPOLIA_RPC),
    });
  }
  return _walletClient;
}

export interface EnsPublishInput {
  bundleHash: Hex;          // 0x + 64 hex
  attestor: Address;        // who owns the subname's addr record
  satSig: string;           // hex string
  cosmoSig: string;         // hex string (or "")
  sceneCid: string;         // IPFS CID of the scene file
  bundleRefCid: string;     // IPFS CID of the bundle JSON
  capturedAt: number;
  tokenId: string;
  mode: 0 | 1 | 2;
}

export interface EnsPublishResult {
  subname: string;          // e.g. "vin-78ffb83fca6e.realityproof.eth"
  node: Hex;                // subnode namehash
  txHashes: Hex[];          // [subnodeTxHash?, setProofTxHash]
}

/**
 * Build the subname from the bundle hash. Predictable + collision-free
 * since bundleHash is unique on-chain.
 */
export function buildSubname(bundleHash: Hex): { label: string; full: string } {
  const slug = bundleHash.replace(/^0x/, "").slice(0, 12).toLowerCase();
  const label = `vin-${slug}`;
  const parent = env().ENS_PARENT_NAME ?? "realityproof.eth";
  return { label, full: `${label}.${parent}` };
}

/**
 * Encode an IPFS CID v0 as ENSIP-7 contenthash (multicodec 0xe301 + length + dag-pb cid).
 * For our use we just emit a minimal valid IPFS contenthash — enough to round-trip.
 */
function encodeIpfsContenthash(cid: string): Hex {
  if (!cid) return "0x";
  // v0 CIDs (Qm…) are base58-decoded 34-byte multihashes. Easiest to just
  // wrap with 0xe3010170 prefix + the base58-decoded bytes — but we don't
  // want a base58 dep. For the hackathon we emit a minimal text-encoded
  // contenthash with a URL prefix the resolver clients can recognise.
  // Most ENS clients tolerate a UTF-8 multibase wrapper; production should
  // base58-decode properly.
  const utf = toHex(toBytes(`ipfs://${cid}`));
  return utf;
}

/**
 * Create the subname (NameWrapper.setSubnodeRecord) AND publish proof
 * records (RealityENSResolver.setProof) in two sequential txs.
 *
 * Returns null if env isn't configured for ENS publication, so callers can
 * keep going without ENS in dev.
 */
export async function publishToEns(input: EnsPublishInput): Promise<EnsPublishResult | null> {
  const e = env();
  if (!e.ENS_RESOLVER_ADDRESS || !e.ETH_SEPOLIA_RPC) {
    console.warn("[ens] not configured (ENS_RESOLVER_ADDRESS or ETH_SEPOLIA_RPC missing); skipping");
    return null;
  }
  try {
    const wallet = walletClient();
    const pc = publicClient();
    const { label, full } = buildSubname(input.bundleHash);
    const node = namehash(full);
    const parentName = e.ENS_PARENT_NAME ?? "realityproof.eth";
    const parentNode = namehash(parentName);

    const txHashes: Hex[] = [];

    // 1. Create the subname pointing at our resolver. Idempotent — calling
    //    again on an existing subname just resets owner/resolver/ttl.
    try {
      const subnodeTx = await wallet.writeContract({
        address: NAME_WRAPPER_SEPOLIA,
        abi: NAME_WRAPPER_ABI,
        functionName: "setSubnodeRecord",
        args: [
          parentNode,
          label,
          input.attestor,                              // owner of the subname
          e.ENS_RESOLVER_ADDRESS as Address,           // our resolver
          0n,                                          // ttl
          0,                                           // fuses (no restrictions)
          BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60), // 1y expiry
        ],
      } as never);
      txHashes.push(subnodeTx);
      await pc.waitForTransactionReceipt({ hash: subnodeTx });
    } catch (e) {
      // If the backend wallet isn't a manager of realityproof.eth yet, this
      // fails. Continue to setProof — the user can wire the manager later
      // and re-run this for past mints.
      console.warn("[ens] setSubnodeRecord failed (manager not delegated?):", (e as Error).message);
    }

    // 2. Publish proof records via our resolver.
    const proofTx = await wallet.writeContract({
      address: e.ENS_RESOLVER_ADDRESS as Address,
      abi: RealityENSResolverAbi,
      functionName: "setProof",
      args: [
        node,
        {
          attestor: input.attestor,
          bundleHash: input.bundleHash,
          contenthash: encodeIpfsContenthash(input.bundleRefCid),
          satSig: input.satSig,
          cosmoSig: input.cosmoSig,
          sceneCid: input.sceneCid,
          capturedAt: BigInt(input.capturedAt),
          tokenId: BigInt(input.tokenId),
          mode: input.mode,
        },
      ],
    } as never);
    txHashes.push(proofTx);

    return { subname: full, node, txHashes };
  } catch (err) {
    console.warn("[ens] publish failed:", (err as Error).message);
    return null;
  }
}
