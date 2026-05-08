/**
 * Quick probe of all cTRNG sources to see which one is currently returning
 * a satellite signature.
 *
 * Usage: pnpm --filter @proof-of-reality/api exec tsx scripts/probe-ctrng.ts
 */
try { process.loadEnvFile(".env"); } catch {}

import { OrbitportSDK } from "@spacecomputer-io/orbitport-sdk-ts";

const sdk = new OrbitportSDK({
  config: {
    clientId: process.env.ORBITPORT_CLIENT_ID!,
    clientSecret: process.env.ORBITPORT_CLIENT_SECRET!,
  },
});

for (const src of ["trng", "rng", "ipfs"] as const) {
  console.log(`\n--- src: ${src} ---`);
  try {
    const r = await sdk.ctrng.random({ src });
    console.log(JSON.stringify(r.data, null, 2));
  } catch (e) {
    console.log("error:", (e as Error).message);
  }
}
