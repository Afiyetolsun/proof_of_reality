# Proof of Reality

Web3 oracle for the physical world.

Two capture frontends, one trust pipeline:

- **B2C** — iOS scanner (LiDAR + Object Capture). Trust root = Apple Secure Enclave + App Attest.
- **B2B** — OAK 4 D edge camera + USB Armory Mk II. Trust root = HW-resident ECDSA key.

Both produce the same `ProofBundle`, hit the same backend, mint to the same `RealityProof` contract on Base Sepolia.

Three independent witnesses on every scan:
1. **Cosmic nonce** signed by SpaceComputer satellite (cTRNG)
2. **Bundle hash** co-signed by SpaceComputer KMS (Space Fabric)
3. **Bundle hash** signed by hardware-resident device key (Secure Enclave or USB Armory)

## Layout

```
proof_of_reality/
├── apps/
│   ├── api/            # Vercel serverless backend (TS)
│   ├── viewer/         # Next.js verifier
│   ├── ios/            # B2C Swift app (Xcode project lives here)
│   └── camera-agent/   # B2B Python agent + bare-metal Go firmware for the Armory
├── contracts/          # Hardhat + viem (RealityProof.sol, DeviceRegistry.sol)
├── packages/
│   ├── proof-bundle/         # Canonical schema + zod + keccak. THE source of truth.
│   ├── attestation/          # App Attest + device-key + KMS verifiers
│   ├── contracts-abi/        # ABIs synced from contracts/artifacts
│   ├── verified-swarm-fetch/ # Trustless Swarm gateway client
│   └── tsconfig/             # Shared TS configs
├── docs/               # Architecture, trust model, flows, pitch
└── tools/              # CLIs, demo scripts
```

## Quick start

```bash
pnpm install                    # installs everything across workspaces
pnpm --filter @proof-of-reality/contracts compile
pnpm abi:sync                   # populate packages/contracts-abi from artifacts/
pnpm --filter @proof-of-reality/contracts test
pnpm --filter @proof-of-reality/api dev
pnpm --filter @proof-of-reality/viewer dev
```

Camera agent has its own toolchain (uv + Python 3.11):

```bash
cd apps/camera-agent && uv sync && uv run proof-agent
```

## Status

Hackathon-fresh skeleton. Every team has a clear directory + a stub that compiles. See `docs/` for architecture, trust model, and the 48-hour timeline.
