import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deploys the ENS resolver to Ethereum Sepolia.
 * Pass `admin` = the backend wallet address that will write subname records.
 *
 * Run: cd contracts && pnpm deploy:ens-sepolia --parameters '{"RealityENSResolver":{"admin":"0x8190b71BbCc424D11102EBC13f993e9129Ebd47A"}}'
 *
 * After deploy:
 *   1. In ENS app (sepolia.app.ens.domains/realityproof.eth), set
 *      "Resolver" to the deployed address
 *   2. Set "Manager" to the admin address (so they can also create subnames)
 *   3. Drop the deployed address into apps/api/.env as ENS_RESOLVER_ADDRESS
 */
export default buildModule("RealityENSResolver", (m) => {
  const admin = m.getParameter<string>("admin");
  const resolver = m.contract("RealityENSResolver", [admin]);
  return { resolver };
});
