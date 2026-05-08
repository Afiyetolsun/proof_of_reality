import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deploys both contracts and grants MINTER_ROLE to the backend hot wallet.
 *
 * Run: pnpm --filter @proof-of-reality/contracts deploy:sepolia
 * Required env: BASE_SEPOLIA_RPC, DEPLOYER_PK, BACKEND_MINTER_ADDR
 */
export default buildModule("ProofOfReality", (m) => {
  const admin = m.getAccount(0);
  const backendMinter = m.getParameter<string>("backendMinter");

  const realityProof = m.contract("RealityProof", [admin]);
  const deviceRegistry = m.contract("DeviceRegistry", []);

  // Compute MINTER_ROLE = keccak256("MINTER_ROLE")
  const minterRole =
    "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6" as `0x${string}`;

  m.call(realityProof, "grantRole", [minterRole, backendMinter]);

  return { realityProof, deviceRegistry };
});
