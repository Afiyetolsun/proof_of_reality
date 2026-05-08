import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { RealityProofAbi, DeviceRegistryAbi } from "@proof-of-reality/contracts-abi";
import { env } from "../config/env.js";

let _publicClient: PublicClient | null = null;
let _walletClient: WalletClient | null = null;

export function publicClient(): PublicClient {
  if (_publicClient) return _publicClient;
  _publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(env().BASE_SEPOLIA_RPC),
  });
  return _publicClient;
}

export function walletClient(): WalletClient {
  if (_walletClient) return _walletClient;
  const account = privateKeyToAccount(env().MINTER_PRIVATE_KEY as Hex);
  _walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(env().BASE_SEPOLIA_RPC),
  });
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
