/**
 * ENS resolver client. Reads a Reality NFT's records from our custom
 * RealityENSResolver contract on Eth Sepolia.
 *
 * Why custom resolver, not the standard Public Resolver?
 *   Per-mint subnames carry a structured proof (bundleHash, satSig,
 *   cosmoSig, tokenId, contenthash, etc) — we publish them as TEXT
 *   records via the resolver's setProof(node, Proof) call. Reading
 *   them back is just text(node, key) over standard ENS resolution,
 *   so any ENS-aware client also gets the data.
 */
import {
  createPublicClient,
  http,
  namehash,
  type Address,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";

const ENS_REGISTRY: Address = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

const REGISTRY_ABI = [
  {
    type: "function",
    name: "resolver",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const RESOLVER_ABI = [
  {
    type: "function",
    name: "addr",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
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
  {
    type: "function",
    name: "contenthash",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "bytes" }],
  },
  {
    type: "function",
    name: "exists",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const client = createPublicClient({
  chain: sepolia,
  transport: http(
    process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC ?? "https://ethereum-sepolia-rpc.publicnode.com",
  ),
});

export interface EnsRecord {
  /** The full ENS name resolved (input, possibly auto-suffixed). */
  name: string;
  /** Owner / attestor address — the addr text record. */
  attestor: Address | null;
  /** Decoded contenthash (Swarm/IPFS ref + protocol). */
  content: { protocol: "bzz" | "ipfs"; ref: string } | null;
  /** Reality NFT token id (text record "tokenId"). */
  tokenId: bigint | null;
  /** SHA-256 bundle hash (text record "bundleHash"). */
  bundleHash: Hex | null;
  /** Cosmic-nonce satellite signature (text record "satSig"). */
  satSig: string | null;
  /** Space Fabric KMS co-signature (text record "cosmoSig"). */
  cosmoSig: string | null;
  /** Capture mode (text record "mode"). */
  mode: string | null;
  /** Capture unix-seconds (text record "capturedAt"). */
  capturedAt: number | null;
  /** Long-form description (text record "description"). */
  description: string | null;
  /** Basescan deep-link (text record "url"). */
  url: string | null;
  /** Avatar URL (text record "avatar") — typically the scene file. */
  avatar: string | null;
}

export interface EnsResolveError {
  code: "NOT_FOUND" | "NOT_OUR_RESOLVER" | "RPC_ERROR";
  message: string;
}

/**
 * Auto-suffix a bare label (no dots) with the configured parent.
 * "vin-abc123" → "vin-abc123.realityproof.eth"
 */
export function normalizeName(input: string): string {
  const parent = process.env.NEXT_PUBLIC_ENS_PARENT_NAME ?? "realityproof.eth";
  if (input.includes(".")) return input.toLowerCase();
  return `${input}.${parent}`.toLowerCase();
}

/**
 * Resolve an ENS name to its full Reality NFT record. Returns the
 * resolver's text + contenthash + addr records in one call.
 */
export async function resolveEnsName(
  rawName: string,
): Promise<{ ok: true; record: EnsRecord } | { ok: false; error: EnsResolveError }> {
  const name = normalizeName(rawName);
  const node = namehash(name);
  const expectedResolver = process.env.NEXT_PUBLIC_ENS_RESOLVER_ADDRESS as
    | Address
    | undefined;

  let registryResolver: Address;
  try {
    registryResolver = (await client.readContract({
      address: ENS_REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "resolver",
      args: [node],
    })) as Address;
  } catch (e) {
    return { ok: false, error: { code: "RPC_ERROR", message: (e as Error).message } };
  }

  if (registryResolver === "0x0000000000000000000000000000000000000000") {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: `subname ${name} not registered (registry resolver is zero)`,
      },
    };
  }

  if (
    expectedResolver &&
    registryResolver.toLowerCase() !== expectedResolver.toLowerCase()
  ) {
    return {
      ok: false,
      error: {
        code: "NOT_OUR_RESOLVER",
        message: `subname uses resolver ${registryResolver}, not the expected RealityENSResolver`,
      },
    };
  }

  // Batch-read all records in parallel.
  const keys = [
    "tokenId",
    "bundleHash",
    "satSig",
    "cosmoSig",
    "mode",
    "capturedAt",
    "description",
    "url",
    "avatar",
  ] as const;

  try {
    const [addr, contenthashBytes, ...textValues] = await Promise.all([
      client.readContract({
        address: registryResolver,
        abi: RESOLVER_ABI,
        functionName: "addr",
        args: [node],
      }) as Promise<Address>,
      client.readContract({
        address: registryResolver,
        abi: RESOLVER_ABI,
        functionName: "contenthash",
        args: [node],
      }) as Promise<Hex>,
      ...keys.map(
        (k) =>
          client.readContract({
            address: registryResolver,
            abi: RESOLVER_ABI,
            functionName: "text",
            args: [node, k],
          }) as Promise<string>,
      ),
    ]);

    const text = Object.fromEntries(keys.map((k, i) => [k, textValues[i]])) as Record<
      (typeof keys)[number],
      string
    >;

    return {
      ok: true,
      record: {
        name,
        attestor: addr === "0x0000000000000000000000000000000000000000" ? null : addr,
        content: decodeContenthash(contenthashBytes),
        tokenId: text.tokenId ? BigInt(text.tokenId) : null,
        bundleHash: text.bundleHash ? (text.bundleHash as Hex) : null,
        satSig: text.satSig || null,
        cosmoSig: text.cosmoSig || null,
        mode: text.mode || null,
        capturedAt: text.capturedAt ? Number(text.capturedAt) : null,
        description: text.description || null,
        url: text.url || null,
        avatar: text.avatar || null,
      },
    };
  } catch (e) {
    return { ok: false, error: { code: "RPC_ERROR", message: (e as Error).message } };
  }
}

/**
 * Decode an ENSIP-7 contenthash into protocol + reference.
 *
 *   0xe40101fa011b20<32-byte> → swarm-ns + swarm-manifest
 *   0xe30170<34-byte multihash> → ipfs + dag-pb
 */
function decodeContenthash(
  bytes: Hex,
): { protocol: "bzz" | "ipfs"; ref: string } | null {
  if (!bytes || bytes === "0x") return null;
  const hex = bytes.slice(2).toLowerCase();
  if (hex.startsWith("e40101fa011b20")) {
    return { protocol: "bzz", ref: hex.slice("e40101fa011b20".length) };
  }
  if (hex.startsWith("e30170")) {
    // For IPFS, the bytes after e30170 are the 34-byte multihash; we
    // base58-encode it back to a CIDv0 (Qm…) for the URL.
    const mh = Buffer.from(hex.slice("e30170".length), "hex");
    return { protocol: "ipfs", ref: base58Encode(mh) };
  }
  return null;
}

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Encode(buf: Uint8Array): string {
  let n = 0n;
  for (const b of buf) n = (n << 8n) | BigInt(b);
  let s = "";
  while (n > 0n) {
    const r = Number(n % 58n);
    s = BASE58[r] + s;
    n = n / 58n;
  }
  for (let i = 0; i < buf.length && buf[i] === 0; i++) s = "1" + s;
  return s;
}

/**
 * Build a fetchable URL for a contenthash. Tries the user's VPS Bee
 * first (faster, more reliable for fresh content), falls back to the
 * public gateway.
 */
export function contentUrl(content: NonNullable<EnsRecord["content"]>): string {
  if (content.protocol === "bzz") {
    const local = process.env.NEXT_PUBLIC_BEE_LOCAL;
    const gateway = process.env.NEXT_PUBLIC_SWARM_GATEWAY ?? "https://api.gateway.ethswarm.org";
    return `${(local ?? gateway).replace(/\/$/, "")}/bzz/${content.ref}`;
  }
  return `https://gateway.pinata.cloud/ipfs/${content.ref}`;
}
