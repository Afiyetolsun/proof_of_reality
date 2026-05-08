/**
 * One-time: point realityproof.eth at our RealityENSResolver contract.
 *
 * ENS only lets the MANAGER (not the owner) change the resolver. We
 * delegated manager to the backend wallet, so the backend has to do this
 * call itself — the owner wallet would get reverted.
 *
 * Usage (from repo root):
 *   pnpm --filter @proof-of-reality/api exec tsx scripts/setup-ens-resolver.ts
 *
 * Loads MINTER_PRIVATE_KEY + ETH_SEPOLIA_RPC + ENS_PARENT_NAME +
 * ENS_RESOLVER_ADDRESS from apps/api/.env.
 */
try {
  process.loadEnvFile(".env");
} catch {}

import {
  createPublicClient,
  createWalletClient,
  http,
  namehash,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const NAME_WRAPPER_SEPOLIA: Address = "0x0635513f179D50A207757E05759CbD106d7dFcE8";

const NAME_WRAPPER_ABI = [
  {
    type: "function",
    name: "setResolver",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "resolver", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getData",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "fuses", type: "uint32" },
      { name: "expiry", type: "uint64" },
    ],
  },
] as const;

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

const required = (key: string): string => {
  const v = process.env[key];
  if (!v) {
    console.error(`Missing env var ${key}`);
    process.exit(1);
  }
  return v;
};

const RPC = required("ETH_SEPOLIA_RPC");
const PK = required("MINTER_PRIVATE_KEY") as Hex;
const PARENT = required("ENS_PARENT_NAME");
const RESOLVER = required("ENS_RESOLVER_ADDRESS") as Address;

const node = namehash(PARENT);
const account = privateKeyToAccount(PK);

const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC) });
const pc = createPublicClient({ chain: sepolia, transport: http(RPC) });

console.log(`Setting resolver on ${PARENT}`);
console.log(`  parentNode:    ${node}`);
console.log(`  new resolver:  ${RESOLVER}`);
console.log(`  caller (mgr):  ${account.address}`);

// Show what's set right now (registry and wrapper agree on resolver lookup)
const current = await pc.readContract({
  address: ENS_REGISTRY,
  abi: REGISTRY_ABI,
  functionName: "resolver",
  args: [node],
});
console.log(`  current resolver: ${current}`);

if (current.toLowerCase() === RESOLVER.toLowerCase()) {
  console.log("\n✓ Already set. Nothing to do.");
  process.exit(0);
}

console.log("\nSubmitting setResolver tx via NameWrapper…");
const txHash = await wallet.writeContract({
  address: NAME_WRAPPER_SEPOLIA,
  abi: NAME_WRAPPER_ABI,
  functionName: "setResolver",
  args: [node, RESOLVER],
});
console.log(`  tx: ${txHash}`);
console.log(`  ${`https://sepolia.etherscan.io/tx/${txHash}`}`);

const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
console.log(`\n${receipt.status === "success" ? "✅" : "❌"} status: ${receipt.status}`);

const after = await pc.readContract({
  address: ENS_REGISTRY,
  abi: REGISTRY_ABI,
  functionName: "resolver",
  args: [node],
});
console.log(`  resolver now: ${after}`);
