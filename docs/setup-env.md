# `.env` setup — what to put where, and where to get it

You'll fill four `.env` files. Order matters: contracts first (their addresses unblock backend), then backend (its URL unblocks clients), then viewer + camera-agent.

---

## 1. `contracts/.env`

Used to deploy `RealityProof` and `DeviceRegistry` to Base Sepolia. Source: `contracts/.env.example`.

```bash
cd contracts
cp .env.example .env
```

| Var | Where to get it | Notes |
|---|---|---|
| `BASE_SEPOLIA_RPC` | Public works: `https://sepolia.base.org`. For stability, get a free Alchemy or Infura URL for Base Sepolia. | The default in `.env.example` is fine for the demo. |
| `DEPLOYER_PK` | Generate fresh: `cast wallet new` (foundry) or `node -e "console.log('0x'+require('crypto').randomBytes(32).toString('hex'))"`. **Then fund it.** | Get Sepolia ETH from a faucet: <https://www.alchemy.com/faucets/base-sepolia> or <https://thirdweb.com/base-sepolia-testnet> (~0.05 ETH is plenty). |
| `BACKEND_MINTER_ADDR` | Generate the **backend's** hot wallet (separate from the deployer): same command as above, save both PK + address. The address goes here; the PK goes into `apps/api/.env` as `MINTER_PRIVATE_KEY`. **Then fund the address** with another ~0.05 ETH from the faucet. | This wallet gets `MINTER_ROLE` granted at deploy time. |
| `BASESCAN_API_KEY` | Free signup: <https://basescan.org/myapikey>. Same key works for sepolia.basescan.org. | Only needed for `--verify`. Skip if you don't want contract verification on Basescan. |

### Deploy

Two ways — either from the repo root using the workspace aliases:

```bash
# from repo root
pnpm build:contracts
cd contracts && pnpm deploy:sepolia --parameters '{"backendMinter":"0x<BACKEND_MINTER_ADDR>"}'
cd .. && pnpm abi:sync
```

…or staying inside `contracts/` the whole time:

```bash
cd contracts
pnpm compile
pnpm deploy:sepolia --parameters '{"backendMinter":"0x<BACKEND_MINTER_ADDR>"}'
cd .. && pnpm abi:sync
```

After deploy, **note both deployed addresses** from the Ignition output. They go into `apps/api/.env` and `apps/viewer/.env.local`.

---

## 2. `apps/api/.env`

The backend. This is the big one — almost every value below has a matching value somewhere else.

```bash
cd apps/api
cp .env.example .env
```

| Var | Where to get it | Notes |
|---|---|---|
| `IOS_SHARED_SECRET` | **Generate now**: `openssl rand -hex 32`. | Both iOS app and camera-agent send this as `Authorization: Bearer …` to authenticate to the backend. NOT a crypto key — just a coarse "stop random internet" filter. |
| `ORBITPORT_CLIENT_ID` | ✅ Already have it. | From the SpaceComputer booth. |
| `ORBITPORT_CLIENT_SECRET` | ✅ Already have it. | Same. |
| `KMS_COSIGNER_KEY_ID` | Run the one-time setup script (below) — creates the key on Orbitport once and prints the KeyId. | |
| `KMS_COSIGNER_PUBKEY` | Comes from the same one-time setup. | Pinned in the viewer too, for verification independence. |
| `SWARM_BEE_URL` | Default `https://api.gateway.ethswarm.org` works. If you self-host a Bee node, point here. | |
| `SWARM_POSTAGE_BATCH_ID` | **Pick up from Áron Soós** at the Swarm booth — they're handing out free gift codes. Or buy via `bee-js` if you have BZZ. | This is paid storage credit. Without it, every `/api/upload` fails. |
| `STORAGE_BACKEND` | `swarm` (default). Switch to `ipfs` only if Swarm flakes during demo. | |
| `PINATA_JWT` | Optional fallback. Free signup at <https://app.pinata.cloud/>. | Only needed if `STORAGE_BACKEND=ipfs`. |
| `BASE_SEPOLIA_RPC` | Same as `contracts/.env` — same RPC URL. | |
| `MINTER_PRIVATE_KEY` | The PK whose address you put as `BACKEND_MINTER_ADDR` in `contracts/.env`. **Must be funded with Sepolia ETH** for gas. | If this wallet runs out of gas mid-demo, the mint route returns 502. Top up with the faucet before the live demo. |
| `REALITY_PROOF_ADDRESS` | From the contract deploy output (Ignition prints it). | |
| `DEVICE_REGISTRY_ADDRESS` | Same — from the contract deploy output. | |
| `ENS_PARENT_DOMAIN` | Optional. `realityproof.eth` for the ENS subdomain feature. | |
| `LOG_LEVEL` | `info` is fine. Set to `debug` if you need to trace. | |

### One-time KMS key setup

Run once from the repo root, with your Orbitport creds in env:

```bash
ORBITPORT_CLIENT_ID=… ORBITPORT_CLIENT_SECRET=… \
  pnpm --filter @proof-of-reality/api exec tsx scripts/create-kms-key.ts
```

It prints `KMS_COSIGNER_KEY_ID=…` and the full create-key response. Find the public key field in the response (look for `PublicKey` / `PubKey` / `KeyMaterial`) and paste both values into `apps/api/.env`. Don't run the script again — you'd create a second key and burn quota.

If KMS is unavailable mid-demo, `cosignBundle()` returns `null` and the bundle is minted with `spaceFabric.experimental: true`. The viewer's `verifyCosmoSig` tolerates this — the cTRNG path still gives us the satellite signature on every scan.

### Deploy

```bash
cd apps/api
pnpm dev          # local
# or
vercel link
vercel env add … # for every var above
vercel --prod
```

Note the production URL — that's `PROOF_API_URL` for the camera-agent and `Info.plist` `apiBaseUrl` for iOS.

---

## 3. `apps/viewer/.env.local`

Next.js viewer. Public values only — anything in here ships to the browser.

```bash
cd apps/viewer
cp .env.example .env.local
```

| Var | Where to get it | Notes |
|---|---|---|
| `NEXT_PUBLIC_BASE_SEPOLIA_RPC` | Same as the others. | |
| `NEXT_PUBLIC_REALITY_PROOF_ADDRESS` | From the contract deploy output. Same value as `apps/api/.env`. | |
| `NEXT_PUBLIC_DEVICE_REGISTRY_ADDRESS` | Same. | |
| `NEXT_PUBLIC_KMS_COSIGNER_PUBKEY` | Same value as `KMS_COSIGNER_PUBKEY` in `apps/api/.env`. **Pinning it here is intentional** — the viewer doesn't trust the bundle's own `kmsPk`, it compares against this pinned value. | |
| `NEXT_PUBLIC_SAT_PUBKEY` | After your first successful `/api/nonce` call, look at `satSig.pk` in the response — that's the satellite pubkey. Pin it here. | One per satellite; should be stable across calls during a session. |
| `NEXT_PUBLIC_SWARM_GATEWAY` | Same as `SWARM_BEE_URL` in `apps/api/.env`. | |

---

## 4. `apps/camera-agent/.env`

The Python agent on the OAK 4 D.

```bash
cd apps/camera-agent
cp .env.example .env
```

| Var | Where to get it | Notes |
|---|---|---|
| `PROOF_API_URL` | The production API URL. | `https://api.realityproof.app` (custom domain on Vercel). |
| `PROOF_API_TOKEN` | Same value as `IOS_SHARED_SECRET` in `apps/api/.env`. | Yes, it's confusingly named — it's the bearer token, not an API token in any deeper sense. |
| `ARMORY_SIGNER_URL` | Default `http://10.0.0.1` (the Armory's USB CDC Ethernet IP). Don't change unless you reconfigured the firmware. | |
| `ATTEST_BACKEND` | `armory` if the USB Armory is plugged in and signing. `mock` for laptop dev without HW. | |
| `ORG_ATTESTOR_ADDR` | An Ethereum wallet you control that will register this camera in `DeviceRegistry`. | This wallet becomes the public attestor on every scan. Could be the deployer wallet for the demo, or a separate "org" wallet. |
| `CAPTURE_DURATION_SEC` | `8` is a good default. | |
| `KIOSK_DISPLAY` | `none` for headless. | |

### Provision the camera once

After everything else is set up:

1. Plug the USB Armory into the OAK 4 D's USB-C
2. SSH into the camera, run `proof-agent --print-pubkey` (TODO — wire this in `main.py` if needed for demo)
3. Copy the `deviceAddr` it prints
4. Open `apps/viewer/provision` in a browser, fill in `deviceAddr`, sign the `DeviceRegistry.register` tx with your `ORG_ATTESTOR_ADDR` wallet
5. Camera is now live; every scan from it will pass the on-chain identity check

---

## Summary — what to do right now

1. **Generate two wallets** (deployer + backend minter), fund both with Sepolia ETH from a faucet
2. **Deploy contracts** → note the two addresses
3. **Get a Swarm postage batch ID** from Áron Soós at the booth
4. **Run the KMS one-time setup script** → paste KeyId + pubkey into backend env
5. **Generate `IOS_SHARED_SECRET`**: `openssl rand -hex 32`
6. **Fill `apps/api/.env`**, deploy backend to Vercel
7. **Fill `apps/viewer/.env.local`** with addresses + pinned KMS pubkey + (later) pinned satellite pubkey
8. **Fill `apps/camera-agent/.env`** with API URL + bearer token
9. **First `/api/nonce` call** → grab `satSig.pk`, pin it in viewer

---

## What's a secret vs what's not

| Secret (don't commit, don't ship to clients) | Public (safe to embed) |
|---|---|
| `DEPLOYER_PK` | All deployed addresses |
| `MINTER_PRIVATE_KEY` | KMS pubkey, satellite pubkey |
| `ORBITPORT_CLIENT_SECRET` | Bundle hashes, swarm refs |
| `IOS_SHARED_SECRET` (treat as secret, but really just an API gate) | Device addresses on-chain |
| `SWARM_POSTAGE_BATCH_ID` (it's spendable credit) | Org wallet addresses |
| `PINATA_JWT` | |

The cryptographic trust roots (KMS pubkey, sat pubkey, on-chain registry) are all **public**. Anyone can verify a Reality NFT without holding any secret. The secrets above only protect quota / billing / gas — not trust.
