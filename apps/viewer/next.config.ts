import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: [
    "@proof-of-reality/proof-bundle",
    "@proof-of-reality/attestation",
    "@proof-of-reality/contracts-abi",
    "@proof-of-reality/verified-swarm-fetch",
  ],
  experimental: {
    typedRoutes: true,
  },
};

export default config;
