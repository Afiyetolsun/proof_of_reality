import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    "@proof-of-reality/proof-bundle",
    "@proof-of-reality/attestation",
    "@proof-of-reality/contracts-abi",
    "@proof-of-reality/verified-swarm-fetch",
  ],
  // Workspace lib code uses NodeNext-style ".js" extensions on TS imports
  // (so the same modules are runnable under node directly). Webpack
  // doesn't auto-resolve those without help — teach it ".js" → ".ts" / ".tsx".
  webpack: (cfg) => {
    cfg.resolve = cfg.resolve ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (cfg.resolve as any).extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    return cfg;
  },
  // CORP headers on resources the cross-origin-isolated routes fetch
  // under COEP. The COOP+COEP themselves are set by middleware.ts so
  // we can match dotted ENS names without false-positives on file
  // extensions.
  async headers() {
    return [
      {
        source: "/api/scene",
        headers: [{ key: "Cross-Origin-Resource-Policy", value: "same-origin" }],
      },
      {
        // Pixar USD WASM bundle, served at root because emHdBindings.js
        // fetches the .wasm via relative URL.
        source: "/emHdBindings.:ext(wasm|js|data|worker.js)",
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
