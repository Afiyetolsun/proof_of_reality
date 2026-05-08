import "@nomicfoundation/hardhat-toolbox-viem";
import "@nomicfoundation/hardhat-ignition-viem";
import "@nomicfoundation/hardhat-verify";
import "dotenv/config";

import type { HardhatUserConfig } from "hardhat/config";

const { BASE_SEPOLIA_RPC, DEPLOYER_PK, BASESCAN_API_KEY } = process.env;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      type: "edr",
    },
    baseSepolia: {
      type: "http",
      chainType: "l2",
      url: BASE_SEPOLIA_RPC ?? "https://sepolia.base.org",
      accounts: DEPLOYER_PK ? [DEPLOYER_PK] : [],
      chainId: 84532,
    },
  },
  etherscan: {
    apiKey: {
      baseSepolia: BASESCAN_API_KEY ?? "",
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
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
