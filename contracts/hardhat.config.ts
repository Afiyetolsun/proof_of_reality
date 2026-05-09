import "@nomicfoundation/hardhat-toolbox-viem";
import "@nomicfoundation/hardhat-ignition-viem";
import "@nomicfoundation/hardhat-verify";
import "dotenv/config";

import type { HardhatUserConfig } from "hardhat/config";

const {
  BASE_SEPOLIA_RPC,
  ETH_SEPOLIA_RPC,
  DEPLOYER_PK,
  BASESCAN_API_KEY,
  ETHERSCAN_API_KEY,
} = process.env;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {},
    baseSepolia: {
      url: BASE_SEPOLIA_RPC ?? "https://sepolia.base.org",
      accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
      chainId: 84532,
    },
    // Ethereum Sepolia — used only for the ENS resolver (ENS lives on L1).
    sepolia: {
      url: ETH_SEPOLIA_RPC ?? "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: {
      baseSepolia: BASESCAN_API_KEY ?? "",
      sepolia: ETHERSCAN_API_KEY ?? "",
    },
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
    ],
  },
  // Sourcify is decentralized + key-less. Use as fallback / additional
  // verification target. Etherscan V1 endpoints are EOL; until we
  // migrate to V2 + a single Etherscan.io API key, Sourcify is the
  // working path.
  sourcify: {
    enabled: true,
    apiUrl: "https://sourcify.dev/server",
    browserUrl: "https://repo.sourcify.dev",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
