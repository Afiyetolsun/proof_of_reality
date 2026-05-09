/**
 * ENSIP-7 contenthash decode. Mirrors the implementation in
 * apps/viewer/lib/ens.ts so the gallery is independent of the viewer
 * package, but the byte-level shape is identical:
 *
 *   0xe40101fa011b20<32-byte> → swarm-ns + swarm-manifest
 *   0xe30170<34-byte multihash> → ipfs + dag-pb (CIDv0)
 */
import type { Hex } from "viem";

export interface ContentRef {
  protocol: "bzz" | "ipfs";
  ref: string;
}

export function decodeContenthash(bytes: Hex | string | null | undefined): ContentRef | null {
  if (!bytes || bytes === "0x") return null;
  const hex = (bytes as string).slice(2).toLowerCase();
  if (hex.startsWith("e40101fa011b20")) {
    return { protocol: "bzz", ref: hex.slice("e40101fa011b20".length) };
  }
  if (hex.startsWith("e30170")) {
    const mh = hexToBytes(hex.slice("e30170".length));
    return { protocol: "ipfs", ref: base58Encode(mh) };
  }
  return null;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Encode(buf: Uint8Array): string {
  let n = 0n;
  for (const b of buf) n = (n << 8n) | BigInt(b);
  let s = "";
  while (n > 0n) {
    const r = Number(n % 58n);
    s = BASE58[r] + s;
    n = n / 58n;
  }
  for (let i = 0; i < buf.length && buf[i] === 0; i++) s = "1" + s;
  return s;
}
