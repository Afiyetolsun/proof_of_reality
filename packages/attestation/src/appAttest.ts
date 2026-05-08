import type { ProofBundle } from "@proof-of-reality/proof-bundle";

export interface AppAttestVerifyResult {
  ok: boolean;
  reason?: string;
  keyId?: string;
}

/**
 * Verify an Apple App Attest assertion against the device-signing-hash of the bundle.
 *
 * This is a stub. The real implementation:
 *  1. Parse `assertion` (CBOR-encoded App Attest assertion object)
 *  2. Verify the auth data + RP ID matches our bundle ID
 *  3. Verify the signature over (clientDataHash || authData) with the attested public key
 *  4. Check counter monotonicity (per-keyId)
 *  5. Validate the original attestation chain back to Apple's root CA on first use
 *
 * Reference: https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity
 *
 * For the hackathon happy-path, we accept any well-formed base64 with a non-empty keyId
 * and log a TODO. Tighten before shipping.
 */
export async function verifyAppAttest(
  bundle: ProofBundle,
  challenge: Uint8Array,
): Promise<AppAttestVerifyResult> {
  if (bundle.attestation.type !== "appAttest") {
    return { ok: false, reason: "wrong attestation type" };
  }
  const { keyId, assertion } = bundle.attestation.appAttest;
  if (!keyId || !assertion) return { ok: false, reason: "empty appAttest fields" };
  // TODO(hackathon): wire real verification before claiming the bounty.
  void challenge;
  return { ok: true, keyId };
}
