/**
 * Diagnose a Reality NFT's ENS subname end-to-end:
 *   1. Compute the subname's ENS namehash
 *   2. Ask the ENS Registry which resolver it's pointed at
 *   3. Ask our resolver whether it has data for that node (exists[])
 *   4. If yes, dump every record we wrote
 *
 * Usage:
 *   pnpm --filter @proof-of-reality/api exec tsx scripts/verify-ens.ts \
 *     vin-d50e0624dbb8.realityproof.eth
 */
try {
  process.loadEnvFile(".env");
} catch {}

import { createPublicClient, http, namehash, type Address } from "viem";
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
    name: "exists",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
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
] as const;

const NAME = process.argv[2] ?? "vin-d50e0624dbb8.realityproof.eth";
const RESOLVER = (process.env.ENS_RESOLVER_ADDRESS ??
  "0xF7ce9F50EBc3CDdC1C5Bfab76f6Bead512361493") as Address;
const RPC = process.env.ETH_SEPOLIA_RPC ?? "https://ethereum-sepolia-rpc.publicnode.com";

const node = namehash(NAME);

console.log(`name:       ${NAME}`);
console.log(`namehash:   ${node}`);
console.log(`expected:   ${RESOLVER}`);
console.log(`rpc:        ${RPC}`);
console.log();

const pc = createPublicClient({ chain: sepolia, transport: http(RPC) });

const registryResolver = (await pc.readContract({
  address: ENS_REGISTRY,
  abi: REGISTRY_ABI,
  functionName: "resolver",
  args: [node],
})) as Address;

const matches = registryResolver.toLowerCase() === RESOLVER.toLowerCase();
console.log(`Registry → resolver: ${registryResolver}`);
console.log(`points at OUR resolver? ${matches ? "✅" : "❌ no — subname is using a different resolver"}`);

if (!matches) {
  console.log("\n→ This means setSubnodeRecord didn't pass our resolver address.");
  console.log("  Either ENS_RESOLVER_ADDRESS in Vercel was wrong at mint time,");
  console.log("  or that mint happened before the resolver was deployed.");
  process.exit(1);
}

const ex = (await pc.readContract({
  address: RESOLVER,
  abi: RESOLVER_ABI,
  functionName: "exists",
  args: [node],
})) as boolean;

console.log(`\nOur resolver → exists[node]: ${ex}`);

if (!ex) {
  console.log("\n→ The subname points at our resolver, but setProof was never called.");
  console.log("  publishToEns()'s second tx failed silently. Check Vercel logs:");
  console.log("    https://vercel.com/dashboard → project → Logs → search '[ens]' or '[mint] ENS'");
  process.exit(1);
}

console.log("\nRecords:");
const a = (await pc.readContract({
  address: RESOLVER,
  abi: RESOLVER_ABI,
  functionName: "addr",
  args: [node],
})) as Address;
console.log(`  addr               ${a}`);

for (const key of [
  "bundleHash",
  "satSig",
  "cosmoSig",
  "tokenId",
  "capturedAt",
  "mode",
  "url",
  "description",
  "avatar",
]) {
  const val = (await pc.readContract({
    address: RESOLVER,
    abi: RESOLVER_ABI,
    functionName: "text",
    args: [node, key],
  })) as string;
  console.log(`  text[${key.padEnd(13)}] ${val || "(empty)"}`);
}
