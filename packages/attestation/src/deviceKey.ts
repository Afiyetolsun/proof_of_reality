import { secp256k1 } from "@noble/curves/secp256k1";
import { p256 } from "@noble/curves/p256";
import { keccak_256 } from "@noble/hashes/sha3";
import type { ProofBundle } from "@proof-of-reality/proof-bundle";

export interface DeviceKeyVerifyResult {
  ok: boolean;
  reason?: string;
  recoveredAddr?: `0x${string}`;
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

function bytesToHex(bytes: Uint8Array): `0x${string}` {
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex as `0x${string}`;
}

/**
 * Derive an Ethereum-style address from an uncompressed secp256k1 pubkey
 * (66 bytes incl. 0x04 prefix, or 64 bytes raw).
 */
export function addressFromPubkey(pubkeyHex: string): `0x${string}` {
  const bytes = hexToBytes(pubkeyHex);
  const raw = bytes.length === 65 && bytes[0] === 0x04 ? bytes.slice(1) : bytes;
  if (raw.length !== 64) throw new Error("expected uncompressed pubkey");
  const hash = keccak_256(raw);
  return bytesToHex(hash.slice(-20));
}

/**
 * Verify a device-secure-element signature against the device-signing-hash of the bundle.
 *
 * Two curves are supported, picked by signature length:
 *   - 64 bytes (or 65 with v) → secp256k1 (USB Armory's default in our firmware)
 *   - 64 bytes raw P-256 → if some vendor used P-256 (we record vendor in the bundle)
 *
 * The hackathon path: USB Armory Mk II, ECDSA secp256k1, deriving Ethereum address.
 * That lets us look the device up in DeviceRegistry by address — no on-chain ecrecover needed.
 */
export async function verifyDeviceSig(
  bundle: ProofBundle,
  signingHash: `0x${string}`,
): Promise<DeviceKeyVerifyResult> {
  if (bundle.attestation.type !== "deviceSE") {
    return { ok: false, reason: "wrong attestation type" };
  }
  const { deviceAddr, deviceSig, vendor } = bundle.attestation.deviceSE;
  const hashBytes = hexToBytes(signingHash);
  const sigBytes = hexToBytes(deviceSig);

  if (vendor === "usb-armory-mk2" || vendor === "atecc608") {
    // secp256k1 with recovery byte (65 bytes: r || s || v)
    if (sigBytes.length !== 65) {
      return { ok: false, reason: `unexpected sig length ${sigBytes.length}` };
    }
    const recId = sigBytes[64]! - 27;
    const sig = secp256k1.Signature.fromCompact(sigBytes.slice(0, 64)).addRecoveryBit(recId);
    const recoveredPub = sig.recoverPublicKey(hashBytes).toRawBytes(false);
    const recoveredAddr = addressFromPubkey(bytesToHex(recoveredPub));
    if (recoveredAddr.toLowerCase() !== deviceAddr.toLowerCase()) {
      return { ok: false, reason: "recovered address mismatch" };
    }
    return { ok: true, recoveredAddr };
  }

  if (vendor === "se05x") {
    // P-256, no recovery — verify against the recorded address-as-hash-of-pubkey.
    // For the hackathon, we don't ship this path; flag explicitly.
    return { ok: false, reason: "P-256 verification path not implemented yet" };
  }

  return { ok: false, reason: `unsupported vendor ${vendor satisfies never}` };
}
