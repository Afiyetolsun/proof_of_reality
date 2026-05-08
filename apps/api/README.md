# @proof-of-reality/api

Vercel serverless TypeScript backend. Express on `@vercel/node`.

## Routes

| Route | Auth | Purpose |
|---|---|---|
| `GET /health` | — | Health check |
| `POST /api/nonce` | Bearer | Relay cTRNG cosmic nonce + sat sig from Orbitport |
| `POST /api/upload` | Bearer | Multipart: scene + bundle. Verifies attestation, KMS-cosigns, uploads to Swarm |
| `POST /api/mint` | Bearer | Calls `RealityProof.mint(...)` from the hot wallet |
| `GET /api/device/:addr` | Bearer | Public registry lookup |
| `POST /api/device/register` | Bearer | (Stub — orgs register directly on-chain) |

## What lives here vs not

**Backend holds (and only the backend):**
- `ORBITPORT_CLIENT_SECRET` (API quota)
- `SWARM_POSTAGE_BATCH_ID` (paid-storage credit)
- `MINTER_PRIVATE_KEY` (gas wallet)

**Backend never sees:**
- Device private keys (live in USB Armory or Apple Secure Enclave)
- The cryptographic trust roots (KMS pubkey, satellite pubkey, device addresses) — these are public and pinned in clients

The backend is a thin economic proxy. If it's compromised, an attacker can drain our quota / postage / gas, but cannot forge a real-looking proof.

## Dev

```bash
cp .env.example .env  # fill in everything
pnpm dev              # runs vercel dev
```

## Deploy

```bash
vercel link
# upload every .env var
vercel --prod
```

Hand the production URL + `IOS_SHARED_SECRET` to the iOS team. Hand the same URL + secret to the camera-agent team.
