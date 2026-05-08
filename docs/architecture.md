# Architecture

## High-level diagram

```
                          ┌──────────────────────────────┐
                          │  Orbitport (in orbit + edge) │
                          │   cTRNG, KMS                 │
                          └──────────┬───────────────────┘
                                     │ OAuth client_credentials
                                     │
       ┌─────────────────────────────┴──────────────────────────────┐
       │                                                            │
       ▼                                                            ▼
┌───────────────────────┐                            ┌───────────────────────────┐
│  iOS app (B2C)        │                            │  OAK 4 D + USB Armory MkII│
│                       │                            │  (B2B)                    │
│  Capture (LiDAR)      │                            │  Capture (stereo+RGB)     │
│  Apple Secure Enclave │                            │  Armory ECDSA in DCP+OTPMK│
└──────────┬────────────┘                            └──────────────┬────────────┘
           │                                                        │
           └─────────────────────┬──────────────────────────────────┘
                                 │  Bearer auth
                                 ▼
                  ┌──────────────────────────────────┐
                  │  Backend (Vercel TS, Express)    │
                  │  thin economic proxy:            │
                  │   • Orbitport client secret      │
                  │   • Swarm postage batch ID       │
                  │   • Minter hot wallet PK         │
                  │  no crypto trust delegated here  │
                  └──────────────┬───────────────────┘
                                 │
                                 ▼
                       Base Sepolia: RealityProof.mint(...)
                       Swarm: scene + canonical bundle JSON
                                 │
                                 ▼
                          Viewer verifies (off-chain):
                          1. Swarm CAC of bundle
                          2. Satellite sig on cTRNG nonce
                          3. KMS cosig on bundle hash
                          4. Device sig (HW key + DeviceRegistry) OR App Attest
                          5. OCR'd nonce in scene + anti-spoof
```

## The two hashes

| Hash | What it covers | Who signs |
|---|---|---|
| `deviceSigningHash` | Bundle minus `spaceFabric` block | Device HW key |
| `bundleHash` | Full canonical bundle (with `cosmoSig`) | Stored on-chain |

Order of operations in `/api/upload`:

1. Parse + validate bundle (zod discriminated union)
2. Compute `deviceSigningHash`
3. Verify device sig (B2B) or App Attest (B2C) against it
4. Call `sdk.kms.sign({ message: deviceSigningHash, ... })` → `cosmoSig`
5. Embed `spaceFabric` block
6. Recompute `bundleHash` over the full canonical bundle
7. Upload scene + final bundle to Swarm
8. Return refs + `bundleHash`

`/api/mint` then writes `bundleHash` + the proof commitments into `RealityProof.mint`.

## Canonicalization

RFC 8785 (JCS) subset:
- Object keys sorted lexicographically (recursively)
- Arrays preserve order
- No whitespace
- `undefined` → field omitted
- No floats (schema doesn't use any)

Implemented in three languages — they MUST agree byte-for-byte:
- TypeScript: `packages/proof-bundle/src/canonical.ts`
- Python: `apps/camera-agent/src/proof_of_reality_agent/canonical.py`
- Swift: `apps/ios/.../Crypto/Canonical.swift` (to be written)

## Contract surface

Two contracts on Base Sepolia (chain ID 84532):

- **`RealityProof`** — ERC-721 with on-chain proof commitments. `MINTER_ROLE` granted to backend hot wallet.
- **`DeviceRegistry`** — public registry of B2B device addresses to their org wallets. Permissionless registration.

Verification logic stays off-chain. The contracts are dumb commit logs.

## Bounty alignment

| Bounty | How we hit it |
|---|---|
| **SpaceComputer** ($6k) | Cross-track: hardware (USB Armory) + APIs (cTRNG + KMS). Used in both clients. |
| **Swarm Verified Fetch** ($250) | `packages/verified-swarm-fetch` is a standalone, published library submission. |
| **ENS** | `vin-xxx.realityproof.eth` resolver hooked at mint. |
