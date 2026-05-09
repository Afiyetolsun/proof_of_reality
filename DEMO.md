# Proof of Reality — Demo Walkthrough

## The thing in one sentence

A Reality NFT cryptographically proves that a 3D scan of a physical object happened *here, at this moment, on this device* — anchored by satellite-signed cosmic randomness, co-signed by a space-grade KMS, and looked up by a human-readable ENS name.

## What you'll see (5 minutes)

### 1. Capture (iPhone)
- Open **Proof of Reality** → tap **Object** → scan a small object on the table (~30s)
- A cosmic nonce is fetched from SpaceComputer's Orbitport cTRNG; the iPhone overlays it as a QR + speaks it into the audio track. The nonce is **signed by a satellite** (`satSig`), pinning the scan to a moment in time.
- Tap **Submit Proof**

### 2. Backend pipeline (~10 sec)
The relay (`apps/api`) does six things, all visible in the proof bundle:
1. Verifies the device's hardware signature (Apple App Attest)
2. Cosigns the bundle hash with **Space Fabric KMS** (`cosmoSig`)
3. Embeds satellite + KMS sigs into the canonical bundle
4. Uploads scene + bundle to **Swarm** (decentralized storage; no AWS, no Pinata)
5. Mints an ERC-721 on **Base Sepolia** with `(bundleHash, swarmRef, satSig, cosmoSig)`
6. Publishes a per-mint **ENS subname** on Ethereum Sepolia with all proof commitments as records

### 3. Verify (anyone with a browser)
The success card on iPhone shows three things judges can tap:
- **Basescan** → on-chain proof (the NFT exists, owned by attestor)
- **ENS** → resolves `vin-<bundleHash[2:14]>.realityproof.eth` to the proof's records:
  - `addr` → attestor wallet
  - `contenthash` → ENSIP-7 Swarm reference to the canonical bundle
  - `text bundleHash, satSig, cosmoSig, capturedAt, tokenId, mode, url, avatar`
- **Share menu** → the bundle JSON, ready to verify offline

Anyone with the ENS handle can resolve everything — they don't need our contract address, our backend, or our app.

## The four independent witnesses

Each mint embeds **four cryptographic signatures**, two from SpaceComputer:

| Signature | Witness | Verifiable against |
|---|---|---|
| `satSig` | Orbitport cTRNG satellite | Pinned satellite pubkey |
| `cosmoSig` | Space Fabric KMS (key `kms:proof-of-reality-cosigner-…`) | Pinned KMS pubkey |
| `attestation` | Apple App Attest (per-device key in Secure Enclave) | Apple's CA chain |
| Mint tx signer | Backend hot wallet's `MINTER_ROLE` on RealityProof | On-chain ACL |

If the backend is fully compromised, the attacker can drain our gas/postage budget — they cannot forge a Reality NFT, because they don't have the satellite's key, the KMS's key, or the iPhone's Secure Enclave key.

## Bounty alignment

### SpaceComputer ($strong)
- **cTRNG** is the temporal anchor: cosmic nonce → satellite signature → on-chain commitment
- **KMS** is the integrity anchor: every bundle hash gets a Space Fabric co-signature, verifiable client-side via the pinned pubkey

### ENS ($creative use)
- Each Reality NFT becomes a resolvable handle: `vin-….realityproof.eth`
- Records use canonical ENSIP-7 contenthash for the Swarm bundle (Brave / MetaMask / eth.link can fetch the proof from the name alone)
- ENS is the **canonical sharing surface** — judges resolve from any wallet, no need to know our contract address

### Swarm
- All scenes + bundles live on Swarm via a self-hosted Bee node (`infra/swarm/`)
- Postage stamps purchased on-chain (Gnosis), 30-day capacity for ~4 GB
- `STORAGE_BACKEND=swarm` in production; `ipfs` (Pinata) is the fallback when running without a Bee node

## Try it yourself (no iPhone needed)

```bash
# 1. backend
pnpm --filter @proof-of-reality/api dev

# 2. smoke a mint with a real 3D file (drop any .glb or .usdz at the path)
SCENE_FILE=/path/to/your-asset.usdz \
  pnpm --filter @proof-of-reality/api exec tsx scripts/smoke-mint.ts

# 3. inspect the resulting ENS records
pnpm --filter @proof-of-reality/api exec tsx scripts/verify-ens.ts \
  vin-<bundleHash[2:14]>.realityproof.eth
```

## Live deployments

- Backend: https://proof-of-reality-api.vercel.app
- Contracts: see `docs/private/deployments.md` (Base Sepolia + Eth Sepolia)
- ENS parent: `realityproof.eth` (Sepolia)
- All contracts verified on Sourcify (decentralized, source on IPFS)

## What's deliberately not in scope

- Mainnet — testnet end-to-end is enough to demonstrate the trust model; mainnet is operational, not novel
- B2B camera agent (USB Armory + RoomPlan-on-OAK) — shipped scaffolded, deprioritised in favor of a polished iOS path
- Web viewer — the verifier UI lives in `apps/viewer/`, scaffolded but not the focus; the iOS card + ENS app already prove the trust model end-to-end
