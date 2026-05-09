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
  // Lib code in apps/viewer/lib uses NodeNext-style ".js" extensions on
  // TS imports (so the same modules can be tree-shaken or run under
  // node directly). Webpack doesn't auto-resolve those without help —
  // teach it that ".js" → ".ts" / ".tsx".
  webpack: (cfg) => {
    cfg.resolve = cfg.resolve ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (cfg.resolve as any).extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    return cfg;
  },
};

export default config;
