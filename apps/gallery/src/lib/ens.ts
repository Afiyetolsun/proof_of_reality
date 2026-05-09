/**
 * Single-name ENS resolution. The gallery grid uses ens-subgraph +
 * ens-records to enumerate; the per-name detail page (/[name]) uses
 * resolveEnsName here to fetch one full record over RPC, since the
 * subgraph doesn't expose text record VALUES — only keys.
 *
 * Mirrors apps/viewer/lib/ens.ts so the per-name page logic ported
 * from the viewer continues to compile against this module unchanged.
 * Decode helpers live in ./contenthash to avoid duplication.
 */
import {
  createPublicClient,
  http,
  namehash,
  type Address,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";
import { decodeContenthash, type ContentRef } from "./contenthash.js";

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
] as const;

const client = createPublicClient({
  chain: sepolia,
  transport: http(
    process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC ??
      "https://ethereum-sepolia-rpc.publicnode.com",
    { batch: true },
  ),
});

export interface EnsRecord {
  name: string;
  attestor: Address | null;
  content: ContentRef | null;
  tokenId: bigint | null;
  bundleHash: Hex | null;
  satSig: string | null;
  cosmoSig: string | null;
  mode: string | null;
  capturedAt: number | null;
  description: string | null;
  url: string | null;
  avatar: string | null;
}

export interface EnsResolveError {
  code: "NOT_FOUND" | "NOT_OUR_RESOLVER" | "RPC_ERROR";
  message: string;
}

export function normalizeName(input: string): string {
  const parent = process.env.NEXT_PUBLIC_ENS_PARENT_NAME ?? "realityproof.eth";
  if (input.includes(".")) return input.toLowerCase();
  return `${input}.${parent}`.toLowerCase();
}

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
        tokenId: text.tokenId ? safeBigInt(text.tokenId) : null,
        bundleHash: text.bundleHash ? (text.bundleHash as Hex) : null,
        satSig: text.satSig || null,
        cosmoSig: text.cosmoSig || null,
        mode: text.mode || null,
        capturedAt: text.capturedAt ? Number(text.capturedAt) || null : null,
        description: text.description || null,
        url: text.url || null,
        avatar: text.avatar || null,
      },
    };
  } catch (e) {
    return { ok: false, error: { code: "RPC_ERROR", message: (e as Error).message } };
  }
}

function safeBigInt(s: string): bigint | null {
  try {
    return BigInt(s);
  } catch {
    return null;
  }
}

/** Same-origin proxy URL used by inline 3D viewers. */
export function contentUrl(content: ContentRef): string {
  return `/api/scene?proto=${content.protocol}&ref=${encodeURIComponent(content.ref)}`;
}

/** Direct gateway URL, for "open in new tab" affordances. */
export function directContentUrl(content: ContentRef): string {
  if (content.protocol === "bzz") {
    const gateway =
      process.env.NEXT_PUBLIC_SWARM_GATEWAY ?? "https://api.gateway.ethswarm.org";
    return `${gateway.replace(/\/$/, "")}/bzz/${content.ref}`;
  }
  return `https://gateway.pinata.cloud/ipfs/${content.ref}`;
}
