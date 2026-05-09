# Deploy the Bee node to a VPS

Goal: a publicly-reachable Bee node so Vercel can `STORAGE_BACKEND=swarm` and every mint lands on Swarm. Keeps the same `docker-compose.yml` you already validated locally — just on a server with a real IP and ports open.

Total cost / time: **€5/month + ~25 min one-time setup** (plus the ~$2-3 in xDAI/xBZZ to refund the new wallet).

## Pick a host

Any cheap Linux box works. Concrete picks:

| Provider | Plan | Specs | Cost |
|---|---|---|---|
| **Hetzner** | CX22 | 2 vCPU / 4 GB / 40 GB | €4.51/mo |
| Hetzner | CPX11 | 2 vCPU / 2 GB / 40 GB AMD | €4.13/mo |
| DigitalOcean | s-1vcpu-1gb | 1 vCPU / 1 GB / 25 GB | $6/mo |
| Vultr | vc2-1c-1gb | 1 vCPU / 1 GB / 25 GB | $6/mo |

Bee light node uses ~200 MB RAM + ~1 GB disk in steady state, so the smallest tier on any provider is enough. **Hetzner CX22 is the recommendation** — best price/perf in EU, datacenters in Helsinki / Falkenstein / Nuremberg keep latency to Vercel low.

The walkthrough below uses Hetzner. Steps map 1:1 to any other provider.

## 1. Provision the box (~3 min)

1. <https://hetzner.com> → Cloud → Create Server
2. **Location**: Helsinki or Falkenstein (closest to Vercel's EU edge)
3. **Image**: Ubuntu 24.04
4. **Type**: CX22
5. **SSH key**: paste your public key (`cat ~/.ssh/id_ed25519.pub`)
6. **Firewalls**: skip for now, we'll set with `ufw` after
7. Click Create. You get an IP back, e.g. `95.217.123.45`

## 2. Initial server setup (~5 min)

```bash
ssh root@<your-vps-ip>

# Update + install docker
apt-get update && apt-get upgrade -y
curl -fsSL https://get.docker.com | sh

# Create a non-root user (optional but cleaner)
adduser swarm --disabled-password --gecos ""
usermod -aG docker swarm
mkdir -p /home/swarm/.ssh
cp /root/.ssh/authorized_keys /home/swarm/.ssh/
chown -R swarm:swarm /home/swarm/.ssh
chmod 700 /home/swarm/.ssh
chmod 600 /home/swarm/.ssh/authorized_keys

# Switch to the swarm user for the rest
exit
ssh swarm@<your-vps-ip>
```

## 3. Clone + start Bee (~3 min)

```bash
# On the VPS
git clone https://github.com/Afiyetolsun/proof_of_reality.git
cd proof_of_reality/infra/swarm

cp .env.example .env
nano .env
# Set:
#   BEE_PASSWORD=<8+ char string, persisted in the docker volume>
#   BEE_NAT_ADDR=<your-vps-ip>:1634
# Save + exit (Ctrl-O, Enter, Ctrl-X)

docker compose up -d

# Wait ~30 sec, check status
sleep 30
./bee-setup.sh status
```

Expected output:
```
wallet:  0xABCD…1234   ← NEW address (different from your laptop's)
chequebook: true
⏳ /wallet, /chequebook, /stamps are 503 because Bee is still …
```

This is the **fresh** wallet on the VPS. Your laptop's wallet stays local.

## 4. Fund the new wallet (~5 min)

Same flow as before, just funding a different address:

1. Personal MetaMask on Gnosis Chain → send **0.1 xDAI** to the printed `0xABCD…1234`
2. Same → send **0.5 xBZZ** (token contract `0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da`) to the same address

Verify on the VPS:

```bash
./bee-setup.sh status
# Should now show non-zero xDAI and xBZZ
```

If `/wallet` still returns 503 ("syncing"), wait — fresh nodes take ~10-15 min to finish their first sync.

## 5. Buy a stamp

```bash
STAMP_DAYS=30 ./bee-setup.sh stamp
# → ✅ batch ID: 0x...
```

Save this batch ID. It's different from your laptop's; this one belongs to the VPS node.

## 6. Open ports + lock firewall

```bash
# Allow your own SSH (so you don't lock yourself out)
sudo ufw allow OpenSSH
sudo ufw allow 1634/tcp comment 'Bee P2P'

# Bee API: open to Vercel only.
# Vercel publishes their egress ranges; here are the most common ones
# as of 2026 (verify at https://vercel.com/docs/edge-network/regions before
# committing — they may have added more):
sudo ufw allow from 76.76.21.0/24 to any port 1633 proto tcp comment 'Vercel'
sudo ufw allow from 76.76.0.0/16 to any port 1633 proto tcp comment 'Vercel'

# Also open 1633 from your home IP (lets you run smoke / verify-ens)
sudo ufw allow from $(curl -s ifconfig.me) to any port 1633 proto tcp comment 'home'

sudo ufw enable
sudo ufw status verbose
```

If you want zero-fuss now and tighten later, you can `sudo ufw allow 1633/tcp` (open to the world). Bee's API doesn't expose your private key, but anyone could query node metadata. Acceptable for hackathon, **not** for prod.

## 7. Smoke test from anywhere

```bash
# From your laptop (replaces localhost with VPS IP)
BEE_API=http://<vps-ip>:1633 ./infra/swarm/bee-setup.sh status

# Upload a real file via the VPS Bee
SWARM_POSTAGE_BATCH_ID=<vps-batch-id> \
  BEE_API=http://<vps-ip>:1633 \
  ./infra/swarm/bee-setup.sh upload /path/to/some-file.usdz

# Confirm it's globally retrievable via the public Swarm gateway
curl -o /tmp/check.usdz https://gateway.ethswarm.org/bzz/<reference>
```

If you can `curl` the file off the public gateway, your VPS Bee is live and serving the network.

## 8. Point Vercel at the VPS

Vercel → your `proof-of-reality-api` project → **Settings → Environment Variables**, set / update:

| Key | Value |
|---|---|
| `STORAGE_BACKEND` | `swarm` |
| `SWARM_BEE_URL` | `http://<vps-ip>:1633` |
| `SWARM_POSTAGE_BATCH_ID` | `<the batch ID from step 5>` |

Save → **Deployments** tab → ⋯ → **Redeploy** the latest.

Verify with the smoke test against prod:

```bash
SMOKE_API_URL=https://api.realityproof.app \
  pnpm --filter @proof-of-reality/api exec tsx scripts/smoke-mint.ts
```

The output's `swarmRef` line should now be a 64-hex Swarm reference (not a `Qm…` IPFS CID). Open `https://gateway.ethswarm.org/bzz/<ref>` to confirm.

## 9. Background watcher (optional but recommended)

Run the stamp-TTL alarm so you don't get caught by an expired postage batch:

```bash
# On the VPS, in a tmux session that survives logout
tmux new -s swarm-watch
cd ~/proof_of_reality/infra/swarm

# Replace WEBHOOK_URL with a Discord/Slack webhook for alerts.
# Without WEBHOOK_URL it just logs to stdout.
WEBHOOK_URL=https://discord.com/api/webhooks/... \
  WARN_DAYS=5 \
  WATCH_INTERVAL=900 \
  ./bee-setup.sh watch | tee -a /var/log/swarm-watch.log

# Detach with Ctrl-b then d
```

## Cost summary

| Item | Cost | Frequency |
|---|---|---|
| Hetzner CX22 | €4.51 | monthly |
| Domain (optional, for `bee.yourname.eth.link`) | $10 | yearly |
| xDAI for VPS chequebook | $0.10 | one-time |
| xBZZ for 30-day stamp | $0.40 | every ~25 days |

Total ongoing: **~€5/month** to keep Swarm uploads flowing for the entire app.

## Migrate later: swap the laptop wallet onto the VPS

If you ever want the VPS to inherit your laptop's wallet (to keep the same chequebook + stamp), copy the docker volume:

```bash
# On laptop
docker run --rm -v po-bee-data:/d -v $(pwd):/b alpine \
  tar czf /b/bee-data.tgz -C /d .

scp bee-data.tgz swarm@<vps-ip>:~/

# On VPS
cd ~/proof_of_reality/infra/swarm
docker compose down
docker run --rm -v po-bee-data:/d -v $HOME:/b alpine \
  sh -c "rm -rf /d/* && tar xzf /b/bee-data.tgz -C /d"
docker compose up -d
```

For the hackathon I'd rather **start fresh on the VPS** (above) — the $0.40 of new postage is cheaper than the time risk of a mid-transfer corruption.

## What this gets you

- Vercel's prod backend uploads to **real Swarm** (not Pinata fallback).
- `swarmRef` on every minted Reality NFT resolves on the public Swarm gateway from any browser, anywhere — no involvement from us.
- ENS contenthash decodes to the Swarm bundle JSON, so `vin-….realityproof.eth` is fully self-contained as a verifiable proof URL.
- Same Docker config; you can re-deploy this in 10 min on any other provider if Hetzner ever annoys you.

# Phase 2 (when you go past hackathon)

These are not for tonight, but list them so you don't forget:

1. **Auth on the Bee API** — currently the only thing keeping random people from using your stamp is the firewall + the fact they don't know the URL. For prod, put **Caddy** with a Bearer-token middleware in front of port 1633:

   ```
   bee.yourdomain.com {
     @auth header Authorization "Bearer <your-shared-secret>"
     handle @auth { reverse_proxy localhost:1633 }
     respond 401
   }
   ```

   Then on Vercel set `SWARM_BEE_AUTH=<your-shared-secret>` and patch `swarm.service.ts` to send the header.

2. **Auto-renew stamps** — extend `bee-setup.sh watch` to call `./bee-setup.sh stamp` automatically when TTL drops below threshold. Needs the wallet topped up enough to cover the renewal.

3. **Postage chunk price tracker** — Bee adjusts pricing weekly. Have the watcher log the current `pricePerBlock` so you know what stamps will cost next time.

4. **Healthchecks endpoint** — `/health` is fine for liveness but not for swarm-actually-functioning. Build a `/swarm-health` that does a tiny upload + fetch round-trip and compares hashes. Hook to UptimeRobot for "swarm is broken" page.
