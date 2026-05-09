import { createPublicClient, http, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { RealityProofAbi, DeviceRegistryAbi } from "@proof-of-reality/contracts-abi";

const REALITY_PROOF = process.env.NEXT_PUBLIC_REALITY_PROOF_ADDRESS as Address | undefined;
const DEVICE_REGISTRY = process.env.NEXT_PUBLIC_DEVICE_REGISTRY_ADDRESS as Address | undefined;

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? "https://sepolia.base.org"),
});

/**
 * Sentinel error thrown when the contract address env vars aren't set.
 * Caller (the [name] page) downgrades this to a soft "config missing"
 * UI state, instead of dumping viem's StackUnderflow trace into logs.
 */
export class ChainConfigMissingError extends Error {
  constructor(which: string) {
    super(`${which} env var not set`);
    this.name = "ChainConfigMissingError";
  }
}

function isAddressSet(addr: Address | undefined): addr is Address {
  return !!addr && /^0x[0-9a-fA-F]{40}$/.test(addr);
}

export async function getProof(tokenId: bigint) {
  if (!isAddressSet(REALITY_PROOF)) {
    throw new ChainConfigMissingError("NEXT_PUBLIC_REALITY_PROOF_ADDRESS");
  }
  return (await client.readContract({
    address: REALITY_PROOF,
    abi: RealityProofAbi,
    functionName: "getProof",
    args: [tokenId],
  } as never)) as unknown;
}

export async function isDeviceActive(addr: Address): Promise<boolean> {
  if (!isAddressSet(DEVICE_REGISTRY)) {
    throw new ChainConfigMissingError("NEXT_PUBLIC_DEVICE_REGISTRY_ADDRESS");
  }
  return (await client.readContract({
    address: DEVICE_REGISTRY,
    abi: DeviceRegistryAbi,
    functionName: "isActive",
    args: [addr],
  } as never)) as boolean;
}
