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
const KMS_PUBKEY = (process.env.NEXT_PUBLIC_KMS_COSIGNER_PUBKEY ?? null) as `0x${string}` | null;

export async function runVerification(proof: unknown): Promise<VerificationCheck[]> {
  const checks: VerificationCheck[] = [];

  // 0. Fetch the canonical bundle JSON from Swarm (verified)
  const p = proof as { bundleRef: string; swarmRef: string };
  const bundleRes = await verifiedFetch(p.bundleRef, { gateway: SWARM_GATEWAY });
  if (!bundleRes.verified) {
    checks.push({ name: "Swarm content addressing", ok: false, detail: "bundle CAC mismatch" });
    return checks;
  }
  checks.push({ name: "Swarm content addressing", ok: true, detail: bundleRes.scope });

  const bundle = parseProofBundle(JSON.parse(new TextDecoder().decode(bundleRes.data)));

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
    cosmoSig: bundle.spaceFabric.cosmoSig,
    kmsPk: KMS_PUBKEY ?? bundle.spaceFabric.kmsPk,
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
