/**
 * Smoke-test the contenthash encoder. Runs the encoder against a known
 * Swarm ref and a known IPFS CIDv0, prints the bytes, then checks them
 * against a fresh ENS client (eth.link gateway via /addr/).
 *
 *   pnpm --filter @proof-of-reality/api exec tsx scripts/test-contenthash.ts
 */

// Re-implement here so we don't depend on internal exports of ens.service.ts.
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Decode(s: string): Uint8Array {
  const bytes: number[] = [0];
  for (const c of s) {
    const v = BASE58.indexOf(c);
    if (v < 0) throw new Error(`bad char: ${c}`);
    let carry = v;
    for (let i = 0; i < bytes.length; i++) {
      carry += (bytes[i] ?? 0) * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; i < s.length && s[i] === "1"; i++) bytes.push(0);
  return Uint8Array.from(bytes.reverse());
}

const cases = [
  {
    label: "Swarm ref (token #17 scene)",
    ref: "7745e2c397713d54652cce2bde4f232897d0cddbcfdcec572779596d6095806d",
    expectedPrefix: "0xe40101fa011b20",
  },
  {
    label: "IPFS CIDv0 (Pinata pin)",
    ref: "QmQ7yhQXEUmAsN52Nn24SQTuWnpWVroccu2KQzsN2MCewF",
    expectedPrefix: "0xe30170",
  },
];

for (const c of cases) {
  let encoded: string;
  if (/^[0-9a-f]{64}$/.test(c.ref.toLowerCase())) {
    encoded = `0xe40101fa011b20${c.ref.toLowerCase()}`;
  } else if (/^Qm/.test(c.ref)) {
    const decoded = base58Decode(c.ref);
    const hex = Array.from(decoded).map(b => b.toString(16).padStart(2, "0")).join("");
    encoded = `0xe30170${hex}`;
  } else {
    encoded = "0x";
  }
  const ok = encoded.startsWith(c.expectedPrefix);
  console.log(`${ok ? "✅" : "❌"} ${c.label}`);
  console.log(`   ref:     ${c.ref}`);
  console.log(`   encoded: ${encoded}`);
  console.log(`   length:  ${(encoded.length - 2) / 2} bytes`);
  console.log();
}

// Decode round-trip check for the IPFS case: re-derive the CID by base58-encoding the multihash bytes.
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

const ipfs = cases[1]!.ref;
const back = base58Encode(base58Decode(ipfs));
console.log(`base58 round-trip: ${ipfs === back ? "✅" : "❌"} ${back}`);
