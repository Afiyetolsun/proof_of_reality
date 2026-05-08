/**
 * Calls publishToEns() directly with mock data. Bypasses Vercel entirely
 * so we see the actual error message — which the in-prod fire-and-await
 * pattern swallows into a generic warn line.
 *
 * Usage:
 *   pnpm --filter @proof-of-reality/api exec tsx scripts/test-publish-ens.ts
 */
try {
  process.loadEnvFile(".env");
} catch {}

import { publishToEns } from "../src/services/ens.service.js";

const bundleHash = ("0x" +
  Math.random().toString(16).slice(2).padStart(64, "f")) as `0x${string}`;

console.log("Calling publishToEns directly with synthetic input…");
console.log(`  bundleHash: ${bundleHash}`);
console.log(`  resolver:   ${process.env.ENS_RESOLVER_ADDRESS}`);
console.log(`  parent:     ${process.env.ENS_PARENT_NAME}`);
console.log(`  rpc:        ${process.env.ETH_SEPOLIA_RPC}`);
console.log();

try {
  const r = await publishToEns({
    bundleHash,
    attestor: "0x8190b71BbCc424D11102EBC13f993e9129Ebd47A",
    satSig: "STUB",
    cosmoSig: "0x" + "a".repeat(130),
    sceneCid: "QmSceneCidPlaceholder",
    bundleRefCid: "QmBundleCidPlaceholder",
    capturedAt: Math.floor(Date.now() / 1000),
    tokenId: "999",
    mode: 1,
  });

  console.log("\nResult:", r);

  if (r) {
    console.log(`\n✅ subname: ${r.subname}`);
    console.log("Tx hashes:");
    for (const h of r.txHashes) {
      console.log(`  https://sepolia.etherscan.io/tx/${h}`);
    }
  } else {
    console.log("\n❌ publishToEns returned null (failed somewhere — see warnings above)");
  }
} catch (e) {
  console.log("\n❌ publishToEns threw:");
  console.log((e as Error).stack ?? (e as Error).message);
}
