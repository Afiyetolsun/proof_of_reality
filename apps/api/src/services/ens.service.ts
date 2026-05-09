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
  {
    type: "function",
    name: "recordExists",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
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
  label?: string;           // user-chosen subname; nil = use default vin-<hash[2:14]>
}

export interface EnsPublishResult {
  subname: string;          // e.g. "vin-78ffb83fca6e.realityproof.eth"
  node: Hex;                // subnode namehash
  txHashes: Hex[];          // [subnodeTxHash?, setProofTxHash]
}

/**
 * Default deterministic label for a bundle: `vin-<hash[2:14]>`.
 * Collision-free because bundleHash is unique on-chain.
 */
function defaultLabel(bundleHash: Hex): string {
  const slug = bundleHash.replace(/^0x/, "").slice(0, 12).toLowerCase();
  return `vin-${slug}`;
}

/**
 * Pick the desired (pre-collision-check) subname. If the caller passed a
 * user-chosen label we honour it; otherwise we fall through to the
 * deterministic vin- form.
 */
export function buildDesiredSubname(
  bundleHash: Hex,
  label: string | undefined,
  parent: string,
): { label: string; full: string; userSupplied: boolean } {
  const userSupplied = !!label;
  const primary = label ?? defaultLabel(bundleHash);
  return { label: primary, full: `${primary}.${parent}`, userSupplied };
}

/**
 * Back-compat shim. Older callers (verifier scripts, tests) just want the
 * deterministic name from a bundleHash; preserve that signature.
 */
export function buildSubname(bundleHash: Hex): { label: string; full: string } {
  const parent = env().ENS_PARENT_NAME ?? "realityproof.eth";
  const label = defaultLabel(bundleHash);
  return { label, full: `${label}.${parent}` };
}

/**
 * ENSIP-7 contenthash. Detects the ref format and emits the canonical
 * multicodec-prefixed bytes that ENS-aware clients (Brave, MetaMask,
 * eth.link, ens.tools) recognise to resolve to the actual content.
 *
 *   Swarm ref (64 hex)   → 0xe40101fa011b20 + 32-byte hash    (swarm-ns)
 *   IPFS CIDv0 (Qm…)     → 0xe301 + base58_decode(cid)        (ipfs-ns)
 *   Anything else        → 0x  (no record)
 *
 * The Swarm prefix is constant: 0xe4 (swarm-ns) + 0x01 (varint=1) +
 * 0xfa01 (swarm-manifest codec) + 0x1b (keccak-256 multihash code) +
 * 0x20 (32-byte length). For CIDv0 the IPFS prefix 0xe301 sits in front
 * of the base58-decoded multihash (which already encodes its own codec
 * + length internally).
 */
function encodeContenthash(ref: string): Hex {
  if (!ref) return "0x";

  // Swarm reference: 64-char hex (no prefix). Length 64 ± optional 0x.
  const swarmHex = ref.replace(/^0x/, "").toLowerCase();
  if (/^[0-9a-f]{64}$/.test(swarmHex)) {
    return `0xe40101fa011b20${swarmHex}` as Hex;
  }

  // IPFS CIDv0 ("Qm…", 46 base58 chars). base58 decoded = 34 bytes,
  // structured as 0x12 0x20 <32-byte-sha256>. ENSIP-7 prefix is
  // 0xe30170: e3=ipfs-ns, 01=CIDv1, 70=dag-pb codec.
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(ref)) {
    const decoded = base58Decode(ref);
    return ("0xe30170" + Array.from(decoded).map(b => b.toString(16).padStart(2, "0")).join("")) as Hex;
  }

  // Unknown / future format — leave empty rather than encoding garbage
  // that ENS clients would render as a broken URL.
  return "0x";
}

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Tiny base58 decoder — avoids pulling in a dep just for CIDv0 parsing. */
function base58Decode(s: string): Uint8Array {
  const bytes: number[] = [0];
  for (const c of s) {
    const v = BASE58_ALPHABET.indexOf(c);
    if (v < 0) throw new Error(`invalid base58 char: ${c}`);
    let carry = v;
    for (let i = 0; i < bytes.length; i++) {
      carry += (bytes[i] ?? 0) * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Each leading "1" → leading 0 byte
  for (let i = 0; i < s.length && s[i] === "1"; i++) bytes.push(0);
  return Uint8Array.from(bytes.reverse());
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
    const parentName = e.ENS_PARENT_NAME ?? "realityproof.eth";
    const parentNode = namehash(parentName);

    // Resolve the actual label we'll write. Skip the collision RPC for the
    // default vin- form — bundleHash is unique on-chain and the contract
    // rejects duplicate mints with DuplicateBundle anyway, so paying ~500ms
    // for a check that can't fail is wasted latency.
    const desired = buildDesiredSubname(input.bundleHash, input.label, parentName);
    let chosenLabel = desired.label;

    if (desired.userSupplied) {
      const desiredNode = namehash(desired.full);
      const exists = (await pc.readContract({
        address: ENS_REGISTRY_SEPOLIA,
        abi: ENS_REGISTRY_ABI,
        functionName: "recordExists",
        args: [desiredNode],
      })) as boolean;

      if (exists) {
        // Collision: append a 6-hex suffix from the bundle hash (deterministic
        // per-mint disambiguator). If even THAT is taken, give up on the
        // user's label and use the always-unique vin- form.
        const suffix = input.bundleHash.replace(/^0x/, "").slice(0, 6).toLowerCase();
        const fallbackLabel = `${desired.label}-${suffix}`;
        const fallbackNode = namehash(`${fallbackLabel}.${parentName}`);
        const fallbackExists = (await pc.readContract({
          address: ENS_REGISTRY_SEPOLIA,
          abi: ENS_REGISTRY_ABI,
          functionName: "recordExists",
          args: [fallbackNode],
        })) as boolean;

        chosenLabel = fallbackExists ? defaultLabel(input.bundleHash) : fallbackLabel;
        console.log(
          `[ens] label "${desired.label}" already taken; using "${chosenLabel}" instead`,
        );
      }
    }

    const label = chosenLabel;
    const full = `${label}.${parentName}`;
    const node = namehash(full);

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
          // Prefer the bundle JSON ref (canonical proof manifest); fall
          // back to the scene ref so contenthash is at least non-empty
          // for iOS mints that send bundleRef=local:<hash>.
          contenthash: encodeContenthash(input.bundleRefCid || input.sceneCid),
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
