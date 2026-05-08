import { secp256k1 } from "@noble/curves/secp256k1";

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
 * Our KMS key is created with Scheme=ETHEREUM, KeySpec=ECC_SECG_P256K1.
 * KMS sign with `signingAlgorithm: "ETHEREUM_SECP256K1"` + `messageType: "DIGEST"`
 * produces an Ethereum-style 65-byte signature (r || s || v) over the 32-byte hash.
 *
 * We pin the uncompressed secp256k1 pubkey (0x04 + 64 bytes) in env at backend
 * deploy time. Verification: drop the v byte, verify (r || s) against the pubkey
 * over the bundleHash. No SHA-256 wrapping — KMS signs the digest as-is.
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
  const digest = hexToBytes(args.bundleHashBeforeSpaceFabric);
  const sigBytes = hexToBytes(args.cosmoSig);
  const pk = hexToBytes(args.kmsPk);
  // 65-byte Ethereum-style sig (r || s || v). Drop v for verify.
  const compact = sigBytes.length === 65 ? sigBytes.slice(0, 64) : sigBytes;
  try {
    const ok = secp256k1.verify(compact, digest, pk);
    return ok ? { ok: true } : { ok: false, reason: "secp256k1 verify returned false" };
  } catch (e) {
    return { ok: false, reason: `cosmoSig verify failed: ${(e as Error).message}` };
  }
}
