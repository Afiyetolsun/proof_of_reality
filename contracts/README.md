# @proof-of-reality/contracts

Hardhat 2 + viem. Two contracts:

- **`RealityProof.sol`** — ERC-721 + on-chain proof commitments (bundleHash, swarmRef, satSig, cosmoSig, attestation blob, mode). Mint gated by `MINTER_ROLE` granted to the backend hot wallet.
- **`DeviceRegistry.sol`** — public registry of B2B capture-device addresses. Orgs register devices; viewers verify scans against this registry.

Verification logic (App Attest checks, device-sig recovery, anti-spoof score) lives **off-chain** in the viewer. The contracts only commit to the proof so it can't be retroactively changed.

## Setup

```bash
pnpm install
cp .env.example .env  # fill in DEPLOYER_PK, BACKEND_MINTER_ADDR, BASESCAN_API_KEY
pnpm compile
pnpm test
```

## Deploy

```bash
pnpm deploy:sepolia --parameters '{"backendMinter":"0x..."}'
```

After deploy:

1. Note both deployed addresses → set in `apps/api/.env`
2. Run `pnpm abi:export` to push ABIs into `@proof-of-reality/contracts-abi`
3. Verify on Basescan (auto via `--verify`, or manually `pnpm verify <addr>`)
4. Send a small amount of Sepolia ETH to the backend's `MINTER_ADDR` so it can mint

## Notes

- `solc 0.8.27` with `viaIR` for custom errors + struct returns.
- `viem` everywhere. `hardhat-toolbox-viem` instead of the ethers toolbox.
- `MINTER_ROLE = keccak256("MINTER_ROLE") = 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6`
