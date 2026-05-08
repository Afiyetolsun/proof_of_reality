# Proof of Reality — agent guidance

This is a polyglot monorepo for ETHPrague 2026. When working in this repo:

## Architecture (1 paragraph)

Two clients (iOS B2C, OAK 4 D B2B) capture physical-world scenes, build a canonical `ProofBundle`, and sign its hash with hardware-resident keys (Apple Secure Enclave / USB Armory Mk II ECDSA). The bundle is uploaded to Swarm, co-signed by SpaceComputer KMS, and minted as an ERC-721 on Base Sepolia. Verifiers re-fetch the bundle from Swarm, recompute the canonical hash, and check five independent signatures (Swarm CAC, satellite cTRNG sig, KMS co-sig, device sig + on-chain registry, Apple App Attest if applicable).

## Where things live

- **TS backend**: `apps/api/` — Vercel serverless, Express, viem
- **Next.js viewer**: `apps/viewer/` — verifier UI (`/token/[id]`); will host the future camera viewer
- **Next.js landing**: `apps/landing/` — marketing surface, separate Vercel deploy. See `apps/landing/README.md`
- **iOS B2C app**: `apps/ios/` (Xcode project — created by the iOS dev)
- **B2B camera agent**: `apps/camera-agent/` (Python via uv) + `apps/camera-agent/firmware/armory-signer/` (bare-metal Go via TamaGo)
- **Contracts**: `contracts/` (Hardhat + viem, Solidity 0.8.27)
- **Shared TS packages**: `packages/*` — workspace-linked
- **Brand context**: `PRODUCT.md` and `DESIGN.md` at the root — voice, tokens, anti-references. Load before designing any UI.

## Load-bearing files

- `packages/proof-bundle/src/schema.ts` — THE schema. Touch with care; every team codes against it.
- `packages/proof-bundle/src/canonical.ts` — canonicalization for `bundleHash` and `deviceSigningHash`. Mirrored in `apps/camera-agent/src/proof_of_reality_agent/canonical.py`. **Drift here breaks every proof.** Whenever you change one, change the other and re-run cross-language fixture tests.
- `apps/api/src/routes/upload.routes.ts` — the order of operations (verify device sig → KMS cosign → embed → final hash → upload to Swarm) is the trust model in code. Don't reorder casually.

## Conventions

- Package manager: pnpm. Don't use npm/yarn.
- Node 22+. ESM everywhere (`"type": "module"`).
- Workspace deps use `workspace:*`.
- Logger redacts secrets (see `apps/api/src/utils/logger.ts`). Never log raw assertions, sigs, or private keys.
- Hex strings: always `0x`-prefixed lower-case.
- Address strings: viem `Address` type, `0x` + 40 hex.
- Hash strings: `0x` + 64 hex.

## What lives on the backend vs not

The backend is a **thin economic proxy**:

- ✅ `ORBITPORT_CLIENT_SECRET` (API quota)
- ✅ `SWARM_POSTAGE_BATCH_ID` (paid storage)
- ✅ `MINTER_PRIVATE_KEY` (gas wallet)

The backend NEVER holds:
- Device private keys (live in Secure Enclave or USB Armory)
- The cryptographic trust roots (those are public — KMS pubkey, satellite pubkey, device addresses on-chain)

If the backend is fully compromised, attackers can drain quota/postage/gas, but cannot forge a valid scan.

## Common tasks

- Recompile contracts + sync ABI: `pnpm --filter @proof-of-reality/contracts compile && pnpm abi:sync`
- Type-check everything: `pnpm typecheck`
- Run a single contract test: `pnpm --filter @proof-of-reality/contracts test --grep "name"`

## Status

Hackathon scaffold. Many TODOs marked inline. Don't be precious about replacing stubs — they exist so every team has a compiling skeleton, not because they're correct.
