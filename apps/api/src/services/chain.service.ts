import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { RealityProofAbi, DeviceRegistryAbi } from "@proof-of-reality/contracts-abi";
import { env } from "../config/env.js";

// Lazy single-instance clients. We hide them behind getters so env() is only
// evaluated on first use (Vercel cold start), not at module load.
//
// Typed `any`: viem's deeply-nested generics + pnpm's nested resolution produce
// false-positive "two different types with this name" errors when narrowing
// these vars. The runtime is fine — it's a typecheck-only artifact. Type safety
// for the calls below is preserved by viem's per-call abi generic.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _publicClient: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _walletClient: any;

function publicClient() {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(env().BASE_SEPOLIA_RPC),
    });
  }
  return _publicClient;
}

function walletClient() {
  if (!_walletClient) {
    const account = privateKeyToAccount(env().MINTER_PRIVATE_KEY as Hex);
    _walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(env().BASE_SEPOLIA_RPC),
    });
  }
  return _walletClient;
}

export async function mintRealityProof(args: {
  to: Address;
  bundleHash: Hex;
  swarmRef: string;
  bundleRef: string;
  satSig: Hex;
  cosmoSig: Hex;
  attestation: Hex;
  attestationType: 0 | 1;
  attestor: Address;
  capturedAt: bigint;
  mode: 0 | 1 | 2;
}): Promise<Hex> {
  const wallet = walletClient();
  const txHash = await wallet.writeContract({
    address: env().REALITY_PROOF_ADDRESS as Address,
    abi: RealityProofAbi,
    functionName: "mint",
    args: [
      args.to,
      args.bundleHash,
      args.swarmRef,
      args.bundleRef,
      args.satSig,
      args.cosmoSig,
      args.attestation,
      args.attestationType,
      args.attestor,
      args.capturedAt,
      args.mode,
    ],
  } as never);
  return txHash;
}

export async function isDeviceActive(device: Address): Promise<boolean> {
  return (await publicClient().readContract({
    address: env().DEVICE_REGISTRY_ADDRESS as Address,
    abi: DeviceRegistryAbi,
    functionName: "isActive",
    args: [device],
  } as never)) as boolean;
}
