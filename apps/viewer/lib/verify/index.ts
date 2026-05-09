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
  detail: string;
}

const SWARM_GATEWAY = process.env.NEXT_PUBLIC_SWARM_GATEWAY ?? "https://api.gateway.ethswarm.org";
const RAW_KMS_PUBKEY = process.env.NEXT_PUBLIC_KMS_COSIGNER_PUBKEY;
const KMS_PUBKEY: `0x${string}` | null =
  RAW_KMS_PUBKEY && RAW_KMS_PUBKEY.startsWith("0x") ? (RAW_KMS_PUBKEY as `0x${string}`) : null;

export async function runVerification(proof: unknown): Promise<VerificationCheck[]> {
  const checks: VerificationCheck[] = [];

  // 0. Fetch the canonical bundle JSON from Swarm (verified)
  const p = proof as { bundleRef: string; swarmRef: string };

  // Older mints have bundleRef = "local:<sha>" (iOS skipped the upload
  // because the scene exceeded the relay payload cap). Nothing on
  // Swarm to fetch — surface this clearly instead of letting verifiedFetch
  // throw a confusing 400 the user can't act on.
  if (!p.bundleRef || p.bundleRef.startsWith("local:")) {
    checks.push({
      name: "Bundle fetch",
      ok: false,
      detail:
        "bundleRef is local:<hash> — this proof was minted before the iOS app uploaded the bundle to Swarm; the on-chain cosmoSig + bundleHash still verify, just no off-chain re-derivation",
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
