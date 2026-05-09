# Swarm — decentralized storage for Reality NFT scenes

Self-hosted [Bee](https://github.com/ethersphere/bee) light node, in
Docker. Runs identically on a laptop, a Hetzner VPS, or anywhere else
that has Docker. The backend uploads each ProofBundle's USDZ scene
through this node and embeds the returned Swarm reference in the
canonical bundle.

## What it costs

Real money on Gnosis Chain (no testnet for Swarm production):

- **xDAI** — gas for chequebook + stamp txs. Need ~0.05 (~$0.05).
- **xBZZ** — postage. Need ~0.5 for a depth-20 stamp lasting ~24 days,
  enough capacity for ~4 GB of scenes (≈400-1000 mints).

Total: ~$2-3 in real assets, one-time. Get xDAI from a Gnosis bridge or
faucet, swap a tiny amount to xBZZ on Honeyswap or Cowswap.

## What it gives us

- Real decentralized storage (vs Pinata IPFS, which is centralized
  pinning of IPFS data — fast and free, but ultimately one company).
- Content-addressed Swarm references that go directly on-chain in
  RealityProof.swarmRef.
- Verifier UX: anyone with `https://gateway.ethswarm.org/bzz/<ref>`
  can fetch the scene without involving us at all.

## Setup — laptop

```bash
cd infra/swarm
cp .env.example .env
# edit .env: set BEE_PASSWORD to something with ≥8 chars
docker compose up -d

# Wait ~30s for the node to come online + auto-generate its wallet
./bee-setup.sh status
# Note the "wallet" address that prints
```

Fund the printed address on Gnosis Chain (chainId 100):
- `0.05 xDAI` for gas
- `0.5 xBZZ` for postage

Verify funding landed:

```bash
./bee-setup.sh status
# xDAI and xBZZ balances should be non-zero
```

Buy a postage stamp (one tx, ~10s):

```bash
./bee-setup.sh stamp
# Prints: ✅ batch ID: 0x...
```

Plug the batch ID into `apps/api/.env`:

```env
STORAGE_BACKEND=swarm
SWARM_BEE_URL=http://localhost:1633
SWARM_POSTAGE_BATCH_ID=0x...   # the printed batch ID
```

Restart `pnpm dev:api` and test with `pnpm --filter @proof-of-reality/api exec tsx scripts/smoke-mint.ts`. Scene now lands on Swarm; `swarmRef` in the response will be a Swarm hash, not an IPFS CID.

## Setup — VPS / production

Full step-by-step in **[`DEPLOY.md`](./DEPLOY.md)** — Hetzner CX22 example,
~25 min from "I have nothing" to "Vercel uploads to my Bee node".

Summary: same `docker-compose.yml`, set `BEE_NAT_ADDR=<public-ip>:1634`
in `.env`, open ports 1633/1634, fund the new wallet, buy a stamp,
point `SWARM_BEE_URL=http://<vps-ip>:1633` at Vercel. Cost ~€5/mo.

Funded once, the same wallet+stamp keep working until the stamp's TTL
expires. Re-run `./bee-setup.sh stamp` to mint a new one before then —
or run `./bee-setup.sh watch` to get a Discord/Slack alert before it does.

## Useful commands

```bash
# Live status (peers, balances)
./bee-setup.sh status

# List all postage batches owned by this node
./bee-setup.sh stamps

# Smoke-upload an arbitrary file (no backend involvement)
./bee-setup.sh upload /path/to/scene.usdz

# Tail Bee logs
docker compose logs -f bee

# Stop + restart
docker compose down
docker compose up -d
```

## Troubleshooting

- **`peers: 0` for more than 5 min** → check `BEE_NAT_ADDR` and that port
  1634 is reachable. On a VPS, `sudo ufw allow 1634/tcp`.
- **Stamp purchase reverts** → wallet didn't have enough xDAI for gas
  OR not enough xBZZ. Re-check with `status`.
- **Backend uploads fail with `swarm upload failed: 402`** → batch
  exhausted (too small for the file) or expired. Buy a bigger stamp
  (depth 22 = 16 GB) with `STAMP_DEPTH=22 ./bee-setup.sh stamp`.

## Why a light node, not a full node

Full node = also stores other people's chunks for incentives. Needs
staked BZZ + always-online uptime + meaningful disk + bandwidth.
Light node = upload-only, keeps our footprint to ~200 MB RAM and a
few hundred MB disk. We're a publisher, not a storage provider.
