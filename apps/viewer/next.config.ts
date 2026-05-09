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
  // CORP headers on the resources the isolated /<name> route fetches
  // under COEP. The COOP+COEP themselves are set by middleware.ts so
  // we can match /<name> with dots in it (Next.js header `source`
  // patterns can't easily exclude file-extension paths AND match
  // dotted ENS names).
  async headers() {
    return [
      {
        source: "/api/scene",
        headers: [{ key: "Cross-Origin-Resource-Policy", value: "same-origin" }],
      },
      {
        source: "/usd/:file*",
        headers: [{ key: "Cross-Origin-Resource-Policy", value: "same-origin" }],
      },
      {
        source: "/model-viewer.min.js",
        headers: [{ key: "Cross-Origin-Resource-Policy", value: "same-origin" }],
      },
    ];
  },
};

export default config;
