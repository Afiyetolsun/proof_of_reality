import { keccak_256 } from "@noble/hashes/sha3";
import type { ProofBundle } from "./schema.js";

/**
 * RFC 8785 (JCS) — minimal subset that matches our schema.
 * - Object keys sorted lexicographically (recursively)
 * - Arrays preserve order
 * - No insignificant whitespace
 * - Numbers via JSON.stringify (we never use floats in the bundle)
 *
 * If the schema ever grows floats, swap this for a proper RFC-8785 number formatter.
 */
export function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) {
    throw new Error("canonicalize: undefined values are not allowed");
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("canonicalize: non-finite numbers are not allowed");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return (
      "{" +
      keys
        .filter((k) => obj[k] !== undefined)
        .map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k]))
        .join(",") +
      "}"
    );
  }
  throw new Error(`canonicalize: unsupported type ${typeof value}`);
}

function bytesToHex(bytes: Uint8Array): `0x${string}` {
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex as `0x${string}`;
}

/**
 * Compute the on-chain bundleHash. This is the hash of the FULL canonical bundle
 * INCLUDING the spaceFabric.cosmoSig (the KMS co-signature). It's what RealityProof
 * stores and what verifiers recompute.
 *
 * The DEVICE signs an inner hash that EXCLUDES spaceFabric.cosmoSig (because the
 * device signs first, then the backend co-signs). Use `deviceSigningHash` for that.
 */
export function bundleHash(bundle: ProofBundle): `0x${string}` {
  const canonical = canonicalize(bundle);
  return bytesToHex(keccak_256(new TextEncoder().encode(canonical)));
}

/**
 * The hash the device's hardware key signs. Excludes the spaceFabric block because
 * the backend hasn't co-signed yet at the time the device signs.
 */
export function deviceSigningHash(bundle: ProofBundle): `0x${string}` {
  const { spaceFabric: _omit, ...rest } = bundle;
  const canonical = canonicalize(rest);
  return bytesToHex(keccak_256(new TextEncoder().encode(canonical)));
}
