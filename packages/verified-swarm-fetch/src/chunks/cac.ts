import { keccak_256 } from "@noble/hashes/sha3";

/**
 * Content-Addressed Chunk (CAC) verification.
 *
 * Swarm chunk address = keccak256(span || payload) where span is 8 little-endian
 * bytes encoding the payload length. For single-chunk content (≤4096 bytes), the
 * reference IS the chunk address.
 *
 * Reference: https://docs.ethswarm.org/docs/concepts/DISC/
 */
export function verifyChunk(ref: string, payload: Uint8Array): boolean {
  if (payload.length > 4096) return false;
  const refClean = ref.startsWith("0x") ? ref.slice(2) : ref;

  const span = new Uint8Array(8);
  const len = BigInt(payload.length);
  const view = new DataView(span.buffer);
  view.setBigUint64(0, len, true); // little-endian per Swarm spec

  const buf = new Uint8Array(8 + payload.length);
  buf.set(span, 0);
  buf.set(payload, 8);

  const hash = keccak_256(buf);
  let hex = "";
  for (const b of hash) hex += b.toString(16).padStart(2, "0");
  return hex.toLowerCase() === refClean.toLowerCase();
}
