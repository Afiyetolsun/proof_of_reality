# USDZ → GLB converter

A small HTTP service that converts Apple USDZ scenes (uploaded to Swarm
by older mints) into GLB so the public viewer can render them in-browser
via three.js / model-viewer — no QuickLook needed.

Lives next to the Bee node (same VPS) so fetches + re-uploads stay on
localhost.

## How it works

```
GET /convert?ref=<usdz-swarm-hash>
  → cache hit? return cached GLB ref
  → fetch USDZ from local Bee
  → blender headless: import_scene.usd → export_scene.gltf (GLB)
  → upload GLB back to Bee with our postage stamp
  → cache the (usdz → glb) mapping
  → return { glbRef: "...", sourceRef: "..." }
```

Idempotent. First call ~5–15 s (Blender import + export); subsequent
calls return instantly from disk cache.

## Local test (without a real VPS)

Requires Docker.

```bash
cd infra/converter
cp .env.example .env
# edit .env: STAMP_ID = your existing Bee postage batch
# edit .env: BEE_URL = http://host.docker.internal:1633 (works on Mac + Linux)

docker compose up --build

# in another terminal — convert an existing USDZ ref
curl -s "http://localhost:8080/convert?ref=38bc1d4b730b221b87a88e820266aee57e678e4a5d5f986f356693eafee9bc0a" | jq
# → { "glbRef": "...", "sourceRef": "..." }
```

## VPS deploy (~5 min)

On the same VPS that runs `infra/swarm`:

```bash
cd /opt/proof-of-reality
git pull
cd infra/converter
cp .env.example .env
# STAMP_ID=<the stamp from infra/swarm/.env>
# BEE_URL=http://host.docker.internal:1633

docker compose up -d --build

# Health
curl http://localhost:8080/health
# → { "ok": true, "cached": 0 }
```

Open port 8080 on the VPS firewall (`sudo ufw allow 8080/tcp`).

In the viewer's `.env.local` and Vercel env:

```
NEXT_PUBLIC_CONVERTER_URL=http://<vps-ip>:8080
```

The viewer's `[name]/page.tsx` checks if the contenthash is a Swarm
USDZ ref, calls `/convert?ref=…`, and uses the returned `glbRef` for
the in-canvas render. No on-chain or ENS records are touched — this
is a pure read-side conversion layer.

## Image size + cold start

- First build pulls Ubuntu 24.04 + Blender (~2 GB image) — one-time
- Container start: ~2 s
- First conversion: 5–15 s (depends on USDZ size)
- Cached conversions: ~50 ms

## When a conversion fails

The `/convert` endpoint returns a 502 with the Blender error in the
body. Check `docker compose logs -f converter` for the full stderr —
typically a USD spec edge case (unsupported material, malformed asset
path inside the USDZ). For one-off failures, you can manually run
Blender with the same script to debug:

```bash
docker exec -it po-converter bash
blender --background --python /app/convert.py -- /tmp/scene.usdz /tmp/scene.glb
```
