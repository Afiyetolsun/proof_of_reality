/**
 * End-to-end smoke test: /api/nonce → /api/upload → /api/mint
 *
 * Constructs a minimal ProofBundle with type="appAttest" (the backend's
 * appAttest verifier is a stub that accepts any well-formed input — that's
 * what makes this useful as a local smoke test before iOS / camera-agent
 * are producing real signed bundles).
 *
 * Usage:
 *   # in one terminal: pnpm --filter @proof-of-reality/api dev
 *   # in another:
 *   pnpm --filter @proof-of-reality/api exec tsx scripts/smoke-mint.ts
 */
try { process.loadEnvFile(".env"); } catch {}

import {
  parseProofBundle,
  deviceSigningHash,
  type ProofBundle,
} from "@proof-of-reality/proof-bundle";

const API_URL = process.env.SMOKE_API_URL ?? "http://localhost:4000";
const SECRET = process.env.IOS_SHARED_SECRET;
if (!SECRET) {
  console.error("IOS_SHARED_SECRET must be set in apps/api/.env");
  process.exit(1);
}

const auth = { Authorization: `Bearer ${SECRET}` };

function bytesToHex(bytes: Uint8Array): `0x${string}` {
  let h = "0x";
  for (const b of bytes) h += b.toString(16).padStart(2, "0");
  return h as `0x${string}`;
}

// ---- 1. nonce ----
console.log("→ POST /api/nonce");
const nonceRes = await fetch(`${API_URL}/api/nonce`, { method: "POST", headers: auth });
if (!nonceRes.ok) {
  console.error("  failed:", await nonceRes.text());
  process.exit(1);
}
const nonce = (await nonceRes.json()) as {
  value: `0x${string}`;
  src: string;
  satSig: { value: `0x${string}`; pk: `0x${string}` } | null;
  issuedAt: number;
};
console.log(`  ok — value=${nonce.value.slice(0, 18)}…  src=${nonce.src}  satSig=${nonce.satSig ? "✓" : "null"}`);

// ---- 2. build bundle ----
const now = Math.floor(Date.now() / 1000);
const bundle: ProofBundle = {
  version: "1.0",
  mode: "objectCapture",
  device: { model: "smoke-test-cli", os: "node", appVersion: "0.0.1" },
  capture: {
    startedAt: now - 60,
    endedAt: now,
    frames: 100,
    sceneFormat: "glb",
  },
  nonce: {
    value: nonce.value,
    src: nonce.src,
    satSig: nonce.satSig,
    issuedAt: nonce.issuedAt,
    binding: ["visualQR"],
  },
  spaceFabric: {
    cosmoSig: null,
    kmsPk: null,
    kmsKeyId: null,
    experimental: true,
  },
  sensors: { imu: "test-imu-blob" },
  attestation: {
    type: "appAttest",
    appAttest: {
      keyId: "smoke-test-key",
      assertion: Buffer.from("smoke-test-assertion").toString("base64"),
    },
  },
};
parseProofBundle(bundle); // local validation
console.log(`  innerHash=${deviceSigningHash(bundle).slice(0, 18)}…`);

// ---- 3. upload ----
console.log("→ POST /api/upload");
const fakeSceneBytes = new Uint8Array([0x67, 0x6c, 0x62, 0x00, ...new Uint8Array(252)]);
const fd = new FormData();
fd.append("scene", new Blob([fakeSceneBytes]), "scene.glb");
fd.append(
  "bundle",
  new Blob([JSON.stringify(bundle)], { type: "application/json" }),
  "bundle.json",
);

const uploadRes = await fetch(`${API_URL}/api/upload`, {
  method: "POST",
  headers: auth,
  body: fd,
});
if (!uploadRes.ok) {
  console.error("  failed:", await uploadRes.text());
  process.exit(1);
}
const upload = (await uploadRes.json()) as {
  swarmRef: string;
  bundleRef: string;
  bundleHash: `0x${string}`;
  cosmoSig: `0x${string}` | null;
  sceneSize: number;
};
console.log(`  ok — swarmRef=${upload.swarmRef.slice(0, 16)}…  bundleHash=${upload.bundleHash.slice(0, 18)}…`);
console.log(`  cosmoSig=${upload.cosmoSig ? upload.cosmoSig.slice(0, 18) + "…" : "null (KMS skipped)"}`);

// ---- 4. mint ----
console.log("→ POST /api/mint");
const attestationHex = bytesToHex(new TextEncoder().encode(JSON.stringify(bundle.attestation)));
// Contract requires non-empty satSig; pad with 0x00 when satellite is offline.
const satSigHex = nonce.satSig?.value ?? "0x00";
const mintBody = {
  to: process.env.SMOKE_RECIPIENT ?? "0x8190b71BbCc424D11102EBC13f993e9129Ebd47A",
  bundleHash: upload.bundleHash,
  swarmRef: upload.swarmRef,
  bundleRef: upload.bundleRef,
  satSig: satSigHex,
  cosmoSig: upload.cosmoSig ?? "0x00",
  attestation: attestationHex,
  attestationType: 0, // appAttest
  attestor: "0x0000000000000000000000000000000000000000",
  capturedAt: bundle.capture.startedAt.toString(),
  mode: 1, // objectCapture
};

const mintRes = await fetch(`${API_URL}/api/mint`, {
  method: "POST",
  headers: { ...auth, "Content-Type": "application/json" },
  body: JSON.stringify(mintBody),
});
if (!mintRes.ok) {
  console.error("  failed:", await mintRes.text());
  process.exit(1);
}
const mint = (await mintRes.json()) as { txHash: string; explorerUrl: string };

console.log("\n✅ minted");
console.log(`  tx:       ${mint.txHash}`);
console.log(`  explorer: ${mint.explorerUrl}`);
console.log(`  scene:    https://gateway.pinata.cloud/ipfs/${upload.swarmRef}`);
console.log(`  bundle:   https://gateway.pinata.cloud/ipfs/${upload.bundleRef}`);
