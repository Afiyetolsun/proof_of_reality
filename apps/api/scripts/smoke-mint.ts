/**
 * End-to-end smoke test mimicking the iOS app's exact wire protocol.
 *
 *   1. POST /api/nonce       (X-Voxelio-Key auth, expects { nonce, satSig, expiresAt })
 *   2. POST /api/upload      (multipart bundle + scene + optional audio,
 *                             SHA-256 of bundle bytes is the bundleHash)
 *   3. POST /api/mint        (iOS shape — no `to`, no `attestor`,
 *                             attestation as base64 or "MOCK")
 *
 * Reproduces what voxelio_web3 (iOS app) does, against our backend, so we
 * can verify the wire protocol without booting Xcode.
 *
 * Usage:
 *   # terminal A: pnpm --filter @proof-of-reality/api dev
 *   # terminal B:
 *   pnpm --filter @proof-of-reality/api exec tsx scripts/smoke-mint.ts
 */
try {
  process.loadEnvFile(".env");
} catch {}

import { createHash } from "node:crypto";

const API_URL = process.env.SMOKE_API_URL ?? "http://localhost:4000";
const SECRET = process.env.IOS_SHARED_SECRET;
if (!SECRET) {
  console.error("IOS_SHARED_SECRET must be set in apps/api/.env");
  process.exit(1);
}

// iOS uses X-Voxelio-Key, no "Bearer" prefix.
const auth = { "X-Voxelio-Key": SECRET };

// ---- 1. nonce ----
console.log("→ POST /api/nonce");
const nonceRes = await fetch(`${API_URL}/api/nonce`, { method: "POST", headers: auth });
if (!nonceRes.ok) {
  console.error("  failed:", await nonceRes.text());
  process.exit(1);
}
const nonce = (await nonceRes.json()) as {
  nonce: string;
  satSig: string;
  expiresAt: number;
  satPk: string | null;
  src: string;
};
console.log(`  ok — nonce=${nonce.nonce.slice(0, 18)}…  src=${nonce.src}  satSig=${nonce.satSig || "(empty)"}`);

// ---- 2. build iOS-shaped bundle JSON (matches voxelio_web3/ProofBundle.swift) ----
const now = Math.floor(Date.now() / 1000);
const sceneBytes = new Uint8Array(256);
sceneBytes.set([0x67, 0x6c, 0x62, 0x00], 0); // pseudo-GLB magic
const sceneSha = createHash("sha256").update(sceneBytes).digest("hex");

const bundle = {
  version: 1,
  mode: "objectCapture",
  createdAt: now,
  nonce: nonce.nonce,
  satSig: nonce.satSig,
  nonceExpiresAt: nonce.expiresAt,
  scene: { name: "scene.glb", sha256: sceneSha, bytes: sceneBytes.byteLength },
  audio: null,
  sensorsHash: createHash("sha256").update("smoke-test-sensors").digest("hex"),
  device: {
    model: "smoke-test-cli",
    osVersion: "node-22",
    bundleId: "io.voxelio.smoke",
  },
};

// iOS canonicalEncode uses JSONEncoder.sortedKeys + withoutEscapingSlashes.
// Node's JSON.stringify with manually-sorted keys produces the same bytes for
// the schema we use here (no slashes, no unicode beyond BMP).
function canonicalSorted(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return "[" + value.map(canonicalSorted).join(",") + "]";
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalSorted(o[k])).join(",") + "}";
  }
  throw new Error(`canonicalSorted: unsupported ${typeof value}`);
}

const bundleBytes = new TextEncoder().encode(canonicalSorted(bundle));
const expectedHash = "0x" + createHash("sha256").update(bundleBytes).digest("hex");
console.log(`  bundle SHA-256 (iOS-equiv): ${expectedHash.slice(0, 18)}…`);

// ---- 3. upload ----
console.log("→ POST /api/upload");
const fd = new FormData();
fd.append("bundle", new Blob([bundleBytes], { type: "application/json" }), "bundle.json");
fd.append("scene", new Blob([sceneBytes], { type: "model/vnd.usdz+zip" }), bundle.scene.name);
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
  bundleHash: string;
  bundleRef?: string;
  cosmoSig: string | null;
  sceneBytes: number;
};
console.log(`  ok — swarmRef=${upload.swarmRef.slice(0, 16)}…  bundleHash=${upload.bundleHash.slice(0, 18)}…`);
console.log(`  cosmoSig=${upload.cosmoSig ? upload.cosmoSig.slice(0, 18) + "…" : "null"}`);
if (upload.bundleHash.toLowerCase() !== expectedHash.toLowerCase()) {
  console.error(`  ✗ bundleHash mismatch! expected ${expectedHash}, got ${upload.bundleHash}`);
  process.exit(1);
}
console.log("  ✓ backend SHA-256 matches client SHA-256");

// ---- 4. mint (iOS shape — no `to`, no `attestor`) ----
console.log("→ POST /api/mint");
const mintBody = {
  swarmRef: upload.swarmRef,
  bundleRef: `local:${upload.bundleHash.slice(2)}`, // iOS sends local:<sha>
  bundleHash: upload.bundleHash,
  satSig: nonce.satSig || "STUB",
  cosmoSig: upload.cosmoSig ?? "",
  attestation: Buffer.from("smoke-test-app-attest-assertion").toString("base64"),
  attestationType: 0,
  capturedAt: bundle.createdAt,
  mode: 1,
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
const mint = (await mintRes.json()) as {
  txHash: string;
  tokenId: string;
  ensName: string | null;
  stub: boolean;
  explorerUrl: string;
};

// Swarm refs are 64-char hex; IPFS CIDs start with "Qm" (v0) or "bafy" (v1).
const refUrl = (ref: string): string => {
  if (/^[0-9a-f]{64}$/i.test(ref)) {
    return `https://gateway.ethswarm.org/bzz/${ref}`;
  }
  return `https://gateway.pinata.cloud/ipfs/${ref}`;
};

console.log("\n✅ minted via iOS-shaped wire protocol");
console.log(`  tokenId:  ${mint.tokenId}`);
console.log(`  tx:       ${mint.txHash}`);
console.log(`  explorer: ${mint.explorerUrl}`);
console.log(`  scene:    ${refUrl(upload.swarmRef)}`);
if (upload.bundleRef) {
  console.log(`  bundle:   ${refUrl(upload.bundleRef)}`);
}
if (mint.ensName) {
  console.log(`  ens:      ${mint.ensName}`);
  console.log(`  resolve:  https://sepolia.app.ens.domains/${mint.ensName}`);
} else {
  console.log("  ens:      (not yet — server is missing ENS_PARENT_NAME or ENS_RESOLVER_ADDRESS)");
}
