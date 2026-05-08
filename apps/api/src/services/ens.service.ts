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
 * Ethereum Sepolia. We do two txs per mint:
 *   1. ENS Registry.setSubnodeRecord(parentNode, labelHash, owner, resolver, ttl)
 *      → registers the subnode and points it at our custom resolver
 *   2. RealityENSResolver.setProof(subnode, proof)
 *      → writes the per-token records (bundleHash, satSig, cosmoSig, etc.)
 *
 * We talk to the ENS Registry directly rather than NameWrapper because
 * realityproof.eth is currently unwrapped (Registry.owner is the backend
 * wallet, not the NameWrapper contract). NameWrapper would revert with
 * OperationProhibited / NameIsNotWrapped on names it doesn't own.
 *
 * If any step fails we log + return null. The mint itself never blocks
 * on ENS publication — caller (mint route) decides whether to await.
 */

const ENS_REGISTRY_SEPOLIA: Address = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

const ENS_REGISTRY_ABI = [
  {
    type: "function",
    name: "setSubnodeRecord",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "label", type: "bytes32" },
      { name: "owner", type: "address" },
      { name: "resolver", type: "address" },
      { name: "ttl", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
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

    // Both txs are sent back-to-back without awaiting their receipts.
    // Reason: each Eth Sepolia receipt takes 12-24s and Vercel kills the
    // serverless function around 60s total — including the Base Sepolia
    // mint receipt earlier in the request, two ENS receipt waits would
    // tip us over and the second tx would get cut off.
    //
    // We set explicit nonces because viem's auto-nonce reads from the RPC
    // each call; if we send tx 1 and immediately call writeContract again
    // before tx 1 lands, the second call might pick the same nonce.

    const baseNonce = await pc.getTransactionCount({
      address: privateKeyToAccount(env().MINTER_PRIVATE_KEY as Hex).address,
    });

    const labelHash = keccak256(toBytes(label));

    const subnodeTx = (await wallet.writeContract({
      address: ENS_REGISTRY_SEPOLIA,
      abi: ENS_REGISTRY_ABI,
      functionName: "setSubnodeRecord",
      args: [
        parentNode,
        labelHash,
        input.attestor,
        e.ENS_RESOLVER_ADDRESS as Address,
        0n,
      ],
      nonce: baseNonce,
    } as never)) as Hex;

    const proofTx = (await wallet.writeContract({
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
      nonce: baseNonce + 1,
    } as never)) as Hex;

    return { subname: full, node, txHashes: [subnodeTx, proofTx] };
  } catch (err) {
    console.warn("[ens] publish failed:", (err as Error).message);
    return null;
  }
}
