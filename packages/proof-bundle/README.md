# @proof-of-reality/proof-bundle

The single source of truth for the `ProofBundle` schema. Every team — backend, iOS, camera-agent, viewer — codes against this.

## What's in the bundle

A `ProofBundle` is the canonical JSON document that gets stored on Swarm and whose hash gets minted on-chain. It binds:

1. **Device + capture metadata** — what scanned, when, what format
2. **Cosmic nonce** — `value`, `satSig`, source. From SpaceComputer Orbitport cTRNG.
3. **Space Fabric co-signature** — `cosmoSig` over the bundle hash by SpaceComputer KMS. Added by backend before Swarm upload.
4. **Sensors** — IMU/GPS/baro snapshot at capture
5. **Attestation** — discriminated union:
   - `appAttest` (B2C): Apple App Attest assertion
   - `deviceSE` (B2B): hardware secure-element signature (USB Armory Mk II / ATECC608 / SE05x)

## Two hashes — keep them straight

| Hash | What it covers | Who signs it |
|---|---|---|
| `deviceSigningHash(bundle)` | Bundle minus `spaceFabric` block | Device HW key (Secure Enclave or USB Armory) |
| `bundleHash(bundle)` | Full canonical bundle including `cosmoSig` | This is what's stored on-chain |

Order of operations:

```
client builds bundle (no spaceFabric yet)
  → device signs deviceSigningHash → embeds attestation
  → POST /api/upload
    → backend computes deviceSigningHash, verifies device sig
    → backend calls KMS sign(bundleHashHexWithoutSpaceFabric) → cosmoSig
    → backend embeds spaceFabric block
    → backend computes bundleHash = keccak(canonical(full bundle))
    → backend uploads canonical bundle JSON to Swarm
    → returns swarmRef + bundleHash to client
  → POST /api/mint with bundleHash, swarmRef, etc.
    → backend mints on Base Sepolia
```

## Canonicalization

We use a minimal subset of RFC 8785 (JCS):

- Object keys sorted lexicographically, recursively
- Arrays preserve order
- No whitespace
- `undefined` → field omitted
- No floats (the schema doesn't use any)

Every signer reproduces this exact bytes-for-bytes. **Drift here breaks every proof.**

## Usage

```ts
import { parseProofBundle, bundleHash, deviceSigningHash } from "@proof-of-reality/proof-bundle";

const bundle = parseProofBundle(json); // throws on invalid
const innerHash = deviceSigningHash(bundle); // device signs this
// ... device fills in attestation, backend fills in spaceFabric ...
const onChainHash = bundleHash(bundle); // this gets minted
```

## Python mirror

The Python camera-agent re-implements `canonicalize` byte-for-byte in
`apps/camera-agent/src/proof_of_reality_agent/canonical.py`. Tests in both
languages must produce identical hashes for the same input. **CI gate this.**
