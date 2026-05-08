import { p256 } from "@noble/curves/p256";
import { sha256 } from "@noble/hashes/sha2";

export interface CosmoSigVerifyResult {
  ok: boolean;
  reason?: string;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2) throw new Error("hex length must be even");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Verify SpaceComputer KMS co-signature over the bundle's pre-spaceFabric hash.
 *
 * Per Orbitport SDK: KMS sign with `signingAlgorithm: "ECDSA_SHA_256"` produces an
 * ASN.1 DER ECDSA signature over SHA-256(message). For our use we pass message=DIGEST,
 * which means the KMS signs SHA-256 of our 32-byte hash directly. We pinned KMS pubkey
 * in env at backend deploy time and copied the same pinned pubkey into this verifier.
 *
 * The signature is DER-encoded; convert to compact before passing to noble.
 */
export function verifyCosmoSig(args: {
  bundleHashBeforeSpaceFabric: `0x${string}`;
  cosmoSig: `0x${string}` | null;
  kmsPk: `0x${string}` | null;
  experimentalAllowed: boolean;
}): CosmoSigVerifyResult {
  if (!args.cosmoSig || !args.kmsPk) {
    return args.experimentalAllowed
      ? { ok: true, reason: "cosmoSig missing — experimental tolerance enabled" }
      : { ok: false, reason: "cosmoSig or kmsPk missing" };
  }
  const message = hexToBytes(args.bundleHashBeforeSpaceFabric);
  const digest = sha256(message); // KMS signs SHA-256 of the digest
  const sig = hexToBytes(args.cosmoSig);
  const pk = hexToBytes(args.kmsPk);
  // The Orbitport KMS returns ASN.1 DER; convert to compact r||s before verify.
  try {
    const compact = p256.Signature.fromDER(sig).toCompactRawBytes();
    const ok = p256.verify(compact, digest, pk);
    return ok ? { ok: true } : { ok: false, reason: "p256 verify returned false" };
  } catch (e) {
    return { ok: false, reason: `cosmoSig parse failed: ${(e as Error).message}` };
  }
}
