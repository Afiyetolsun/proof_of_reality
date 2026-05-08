import { createPublicClient, http, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { RealityProofAbi, DeviceRegistryAbi } from "@proof-of-reality/contracts-abi";

const REALITY_PROOF = process.env.NEXT_PUBLIC_REALITY_PROOF_ADDRESS as Address;
const DEVICE_REGISTRY = process.env.NEXT_PUBLIC_DEVICE_REGISTRY_ADDRESS as Address;

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? "https://sepolia.base.org"),
});

export async function getProof(tokenId: bigint) {
  return (await client.readContract({
    address: REALITY_PROOF,
    abi: RealityProofAbi,
    functionName: "getProof",
    args: [tokenId],
  } as never)) as unknown;
}

export async function isDeviceActive(addr: Address): Promise<boolean> {
  return (await client.readContract({
    address: DEVICE_REGISTRY,
    abi: DeviceRegistryAbi,
    functionName: "isActive",
    args: [addr],
  } as never)) as boolean;
}
