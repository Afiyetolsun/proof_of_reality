/**
 * One-time setup: create the SpaceComputer KMS key our backend uses to
 * co-sign every ProofBundle. Run once, copy the printed values into
 * apps/api/.env, never run again (rerunning creates a second key and
 * burns quota).
 *
 * Usage (from repo root):
 *   ORBITPORT_CLIENT_ID=… ORBITPORT_CLIENT_SECRET=… \
 *     pnpm --filter @proof-of-reality/api exec tsx scripts/create-kms-key.ts
 */
import { OrbitportSDK } from "@spacecomputer-io/orbitport-sdk-ts";

const clientId = process.env.ORBITPORT_CLIENT_ID;
const clientSecret = process.env.ORBITPORT_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("ORBITPORT_CLIENT_ID and ORBITPORT_CLIENT_SECRET must be set in env");
  process.exit(1);
}

const sdk = new OrbitportSDK({
  config: { clientId, clientSecret },
});

const r = await sdk.kms.createKey({
  alias: "proof-of-reality-cosigner",
  keySpec: "ECDSA_P256",
  keyUsage: "SIGN_VERIFY",
  scheme: "TRANSIT",
});

console.log("\n=== KMS key created. Copy into apps/api/.env: ===\n");
const meta = (r.data as { KeyMetadata?: { KeyId?: string } }).KeyMetadata;
const keyId = meta?.KeyId;
if (keyId) {
  console.log(`KMS_COSIGNER_KEY_ID=${keyId}`);
}

console.log("\n=== Full create-key response (find the public key field): ===\n");
console.log(JSON.stringify(r.data, null, 2));

console.log("\nFor the public key, look for fields like 'PublicKey' / 'PubKey' /");
console.log("'KeyMaterial' in the response above. Paste it as KMS_COSIGNER_PUBKEY");
console.log("in apps/api/.env and NEXT_PUBLIC_KMS_COSIGNER_PUBKEY in the viewer.\n");
