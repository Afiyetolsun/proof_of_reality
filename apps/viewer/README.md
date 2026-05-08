# @proof-of-reality/viewer

Next.js 15 (App Router) verification viewer. Reads `RealityProof` and
`DeviceRegistry` on-chain via viem, fetches the canonical bundle from Swarm
through `@proof-of-reality/verified-swarm-fetch`, and runs the five-check
verification pipeline.

## Five checks

1. Swarm content-addressing of the bundle (CAC + BMT)
2. Satellite cTRNG signature over the cosmic nonce
3. SpaceComputer KMS co-signature over the bundle hash
4. Device-SE sig + DeviceRegistry lookup (B2B) **or** Apple App Attest (B2C)
5. Visible nonce binding (OCR/QR in scene) + anti-spoof classifier

Checks 4 and 5 are stubbed — wire before demo.

## Routes

- `/` — landing
- `/token/[id]` — token detail + verification
- `/provision` — org-side device registration UI

## Env

Copy `.env.example` to `.env.local` and fill in addresses + pinned pubkeys.
