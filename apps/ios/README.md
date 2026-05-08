# Voxelio Web3 — Proof of Reality

Orbital-anchored verification of physical objects. Built at **ETHPrague 2026** on the SpaceComputer track.

## What it does

Scan a real-world object or room with your iPhone. Before the scan, the app pulls a **cosmic random nonce** from a SpaceComputer satellite via the Orbitport API. That nonce is bound into the capture (visible QR in frame, spoken into the audio track, mixed into sensor timing). Afterwards we hash the scene + sensor logs + nonce + Apple App Attest signature into a `ProofBundle`, push it to Swarm, and mint a **Reality NFT** on Base.

The proof has four orthogonal layers — break one, the others still hold:

| Layer | What it proves |
|---|---|
| Cosmic signature | Scan happened *after* moment T |
| App Attest | Scan came from real Apple hardware |
| Nonce-in-scene | Capture isn't a pre-recorded splat |
| Anti-spoof classifier | Splat physics aren't AI-generated |

## Capture modes

- **RoomPlan** — for real estate, interiors, parametric room layouts
- **Object Capture** — for cars, watches, art, luxury goods, RWA

Both modes share the same Proof Session pipeline.

## Architecture

```
iOS app  ──▶  Vercel relay  ──▶  Orbitport (cosmic nonce)
                            ──▶  Swarm (scene storage)
                            ──▶  Base Sepolia (mint Reality NFT)
                            ──▶  ENS (subdomain per token)
```

### Repos

| Repo | Purpose |
|---|---|
| `voxelio_web3` (this) | iOS capture app |
| `voxelio_web3_api` | Vercel serverless relay |
| `voxelio_web3_contracts` | Foundry contracts on Base |
| `voxelio_web3_viewer` | Next.js verifier with gsplat.js |

## Local setup

```bash
cp voxelio_web3/Resources/Secrets.swift.example voxelio_web3/Resources/Secrets.swift
# edit Secrets.swift — set baseURL to your Vercel relay and sharedKey to
# the same string you set as IOS_SHARED_SECRET in the backend env
open voxelio_web3.xcodeproj
```

Requires iOS 17+, a device with LiDAR for RoomPlan / best-quality Object Capture.

## License

MIT
