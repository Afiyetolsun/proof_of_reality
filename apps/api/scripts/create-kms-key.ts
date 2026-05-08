/**
 * One-time setup: create the SpaceComputer KMS key our backend uses to
 * co-sign every ProofBundle. Run once, copy the printed values into
 * apps/api/.env, never run again (rerunning creates a second key and
 * burns quota).
 *
 * Usage (from repo root):
 *   pnpm --filter @proof-of-reality/api exec tsx scripts/create-kms-key.ts
 *
 * Loads ORBITPORT_CLIENT_ID/SECRET from apps/api/.env automatically. If
 * .env doesn't exist yet, falls back to process.env (so you can also do
 * `ORBITPORT_CLIENT_ID=… ORBITPORT_CLIENT_SECRET=… pnpm …`).
 */
import { OrbitportSDK } from "@spacecomputer-io/orbitport-sdk-ts";

try {
  process.loadEnvFile(".env");
} catch {
  // .env not present yet — fall back to whatever's already in process.env
}

const clientId = process.env.ORBITPORT_CLIENT_ID;
const clientSecret = process.env.ORBITPORT_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("ORBITPORT_CLIENT_ID and ORBITPORT_CLIENT_SECRET must be set in env");
  console.error("Either fill apps/api/.env or pass them inline:");
  console.error("  ORBITPORT_CLIENT_ID=… ORBITPORT_CLIENT_SECRET=… pnpm …");
  process.exit(1);
}

const sdk = new OrbitportSDK({
  config: { clientId, clientSecret },
});
sdk.setDebug(true);

console.log("\n=== Probing KMS capabilities ===\n");
try {
  const caps = await sdk.kms.getCapabilities();
  console.log(JSON.stringify(caps.data, null, 2));
} catch (e) {
  console.error("getCapabilities failed:", (e as Error).message);
  console.error("If your tenant doesn't have KMS enabled, ask SpaceComputer mentors at the booth.");
  process.exit(1);
}

// Use a per-run unique alias so we never collide with a prior partial attempt.
const alias = `proof-of-reality-cosigner-${Date.now()}`;
console.log(`\n=== Creating key with alias=${alias} ===\n`);

// Bypass the SDK so we can see raw error bodies — the SDK throws a generic
// 400 without the message that explains why the server rejected the request.
// Server wants Description AND likely Tags too (deserializer is strict).
const token = await sdk.auth.getValidToken();
async function rpc(method: string, params: unknown): Promise<unknown> {
  const res = await fetch("https://op.spacecomputer.io/api/v1/rpc", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const body = await res.text();
  console.log(`  → HTTP ${res.status}`);
  if (!res.ok) {
    console.log(`  body: ${body}`);
    throw new Error(`${method} failed: ${res.status}`);
  }
  return (JSON.parse(body) as { result: unknown }).result;
}

// Use Scheme: "ETHEREUM" with secp256k1 — the create-key response then
// includes an "Address" (Ethereum-style derived from the pubkey). Orbitport
// has no GetPublicKey RPC, but verifiers don't need the full pubkey: they can
// ecrecover from cosmoSig + bundleHash and compare against the address. Same
// trust shape we already use for the device-key path on the camera.
const result = await rpc("kms.CreateKey", {
  Alias: alias,
  KeySpec: "ECC_SECG_P256K1",
  KeyUsage: "SIGN_VERIFY",
  Scheme: "ETHEREUM",
  Description: "Proof of Reality — bundle hash co-signer",
  Tags: [],
});
const r = { data: result };

const meta = (r.data as { KeyMetadata: { KeyId: string; Address: string | null } }).KeyMetadata;
console.log("\n=== Full create-key response ===\n");
console.log(JSON.stringify(r.data, null, 2));

const fullMeta = r.data as {
  KeyMetadata: { KeyId: string; Address: string | null; PublicKey: string | null };
};

console.log("\n=== KMS key created. Copy into apps/api/.env: ===\n");
console.log(`KMS_COSIGNER_KEY_ID=${fullMeta.KeyMetadata.KeyId}`);
if (fullMeta.KeyMetadata.PublicKey) {
  console.log(`KMS_COSIGNER_PUBKEY=${fullMeta.KeyMetadata.PublicKey}`);
  console.log("\n(Uncompressed secp256k1 pubkey, 0x04 + 64 bytes.");
  console.log(` Ethereum-style address: ${fullMeta.KeyMetadata.Address})`);
} else {
  console.log("\nNo PublicKey in response — re-check the schema.");
}
