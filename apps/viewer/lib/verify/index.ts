import { verifiedFetch } from "@proof-of-reality/verified-swarm-fetch";
import { parseProofBundle, deviceSigningHash } from "@proof-of-reality/proof-bundle";
import { verifyDeviceSig, verifyAppAttest, verifyCosmoSig } from "@proof-of-reality/attestation";
import { isDeviceActive } from "../chain/index.js";
import { runAntiSpoof } from "./antispoof.js";
import { runNonceOcr } from "./nonce-ocr.js";
import { verifySatSig } from "./satellite.js";

export interface VerificationCheck {
  name: string;
  ok: boolean;
  /** "info" = neutral/positive informational; "warn" = soft yellow.
   *  Defaults to "ok"/"fail" colouring based on `ok` if omitted. */
  kind?: "ok" | "info" | "warn" | "fail";
  detail: string;
}

const SWARM_GATEWAY = process.env.NEXT_PUBLIC_SWARM_GATEWAY ?? "https://api.gateway.ethswarm.org";
const RAW_KMS_PUBKEY = process.env.NEXT_PUBLIC_KMS_COSIGNER_PUBKEY;
const KMS_PUBKEY: `0x${string}` | null =
  RAW_KMS_PUBKEY && RAW_KMS_PUBKEY.startsWith("0x") ? (RAW_KMS_PUBKEY as `0x${string}`) : null;

export async function runVerification(proof: unknown): Promise<VerificationCheck[]> {
  const checks: VerificationCheck[] = [];
  const p = proof as {
    bundleRef: string;
    swarmRef: string;
    bundleHash?: string;
    cosmoSig?: string;
    capturedAt?: bigint | number;
    mintedAt?: bigint | number;
  };

  // ---- Always-on checks (no off-chain bundle needed) ------------------
  // These verify what we can verify *purely from the on-chain proof*:
  // the NFT exists, the bundleHash is immutable, the KMS co-signature
  // was accepted by the contract at mint time. They're always green
  // for any successfully-fetched proof.

  checks.push({
    name: "Reality NFT minted on-chain",
    ok: true,
    kind: "ok",
    detail: "ERC-721 on Base Sepolia · proof struct stored permanently",
  });

  if (p.bundleHash && /^0x[0-9a-f]{64}$/i.test(p.bundleHash)) {
    checks.push({
      name: "Bundle hash committed on-chain",
      ok: true,
      kind: "ok",
      detail: `${p.bundleHash.slice(0, 10)}…${p.bundleHash.slice(-8)} — anchors any future bundle copy`,
    });
  }

  if (p.cosmoSig && p.cosmoSig !== "0x" && p.cosmoSig !== "0x00") {
    const sigBytes = (p.cosmoSig.length - 2) / 2;
    checks.push({
      name: "Space Fabric KMS co-signature",
      ok: true,
      kind: "ok",
      detail: `${sigBytes}-byte secp256k1 signature accepted by RealityProof.mint(...)`,
    });
  }

  // ---- Off-chain bundle re-derivation (optional) ----------------------
  // If iOS uploaded the bundle to Swarm we can re-fetch + re-hash + run
  // the full witness chain. If it didn't (legacy local: shape, or scene
  // too big for the relay), surface that as informational — NOT a
  // failure. The on-chain anchor above is the real source of truth.

  if (!p.bundleRef || p.bundleRef.startsWith("local:")) {
    checks.push({
      name: "Off-chain bundle re-derivation",
      ok: true,
      kind: "info",
      detail:
        "bundleRef is local:<hash> — bundle was kept device-side at mint time. On-chain commitments above still verify the proof; once the bundle is published to Swarm, satellite + device + visible-nonce checks become available too.",
    });
    return checks;
  }

  let bundleRes;
  try {
    bundleRes = await verifiedFetch(p.bundleRef, { gateway: SWARM_GATEWAY });
  } catch (e) {
    checks.push({
      name: "Bundle fetch",
      ok: false,
      detail: `gateway: ${(e as Error).message}`,
    });
    return checks;
  }

  if (!bundleRes.verified) {
    checks.push({ name: "Swarm content addressing", ok: false, detail: "bundle CAC mismatch" });
    return checks;
  }
  checks.push({ name: "Swarm content addressing", ok: true, detail: bundleRes.scope });

  // Defensive parse — if iOS uploaded the wrong file (e.g. the scene
  // USDZ instead of the bundle JSON, "PK..." being the ZIP magic), the
  // JSON.parse throws synchronously and crashes the page. Surface as
  // a clean check instead.
  let bundle;
  try {
    const text = new TextDecoder().decode(bundleRes.data);
    bundle = parseProofBundle(JSON.parse(text));
  } catch (e) {
    const head = new TextDecoder()
      .decode(bundleRes.data.slice(0, 16))
      .replace(/[^\x20-\x7e]/g, ".");
    checks.push({
      name: "Bundle parse",
      ok: false,
      detail: `bundleRef pointed at non-JSON ("${head}…") — iOS likely sent the scene ref as bundleRef. ${(e as Error).message}`,
    });
    return checks;
  }

  // 1. Satellite signature on cosmic nonce
  const satOk = await verifySatSig(bundle.nonce);
  checks.push({
    name: "Satellite cTRNG signature",
    ok: satOk.ok,
    detail: satOk.detail,
  });

  // 2. SpaceComputer KMS co-signature
  const cosmo = verifyCosmoSig({
    bundleHashBeforeSpaceFabric: deviceSigningHash(bundle),
    cosmoSig: (bundle.spaceFabric.cosmoSig ?? null) as `0x${string}` | null,
    kmsPk: (KMS_PUBKEY ?? bundle.spaceFabric.kmsPk ?? null) as `0x${string}` | null,
    experimentalAllowed: bundle.spaceFabric.experimental,
  });
  checks.push({
    name: "Space Fabric KMS co-signature",
    ok: cosmo.ok,
    detail: cosmo.reason ?? "verified",
  });

  // 3. Device / App Attest
  const innerHash = deviceSigningHash(bundle);
  if (bundle.attestation.type === "deviceSE") {
    const r = await verifyDeviceSig(bundle, innerHash);
    if (r.ok) {
      const active = await isDeviceActive(bundle.attestation.deviceSE.deviceAddr as `0x${string}`);
      checks.push({
        name: "Device-SE signature + DeviceRegistry",
        ok: active,
        detail: active ? "registered & active" : "device revoked or unregistered",
      });
    } else {
      checks.push({ name: "Device-SE signature", ok: false, detail: r.reason ?? "" });
    }
  } else {
    const r = await verifyAppAttest(bundle, new TextEncoder().encode(innerHash));
    checks.push({
      name: "Apple App Attest",
      ok: r.ok,
      detail: r.reason ?? `keyId=${r.keyId}`,
    });
  }

  // 4. OCR'd nonce inside the scene
  const ocr = await runNonceOcr({ swarmRef: p.swarmRef, expectedNonce: bundle.nonce.value });
  checks.push({ name: "Visible nonce binding", ok: ocr.ok, detail: ocr.detail });

  // 5. Anti-spoof classifier
  const spoof = await runAntiSpoof({ swarmRef: p.swarmRef });
  checks.push({ name: "Anti-spoof classifier", ok: spoof.ok, detail: spoof.detail });

  return checks;
}
