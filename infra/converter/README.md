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
  → blender headless: wm.usd_import → export_scene.gltf (GLB)
  → upload GLB back to Bee with our postage stamp
  → cache the (usdz → glb) mapping
  → return { glbRef: "...", sourceRef: "..." }
```

Idempotent. First call ~5–15 s (Blender import + export); subsequent
calls return instantly from disk cache.

## Why we ship Blender from blender.org, not apt

`apt install blender` on Ubuntu 24.04 gives you 4.0.2 — but compiled
**without USD**. The import operator silently no-ops, your GLB ends up
empty, and you spend an evening figuring out why. The official LTS
tarball from blender.org bundles the Pixar USD library, which is the
only configuration that actually works for our inputs.

The Dockerfile asserts USD support at build time:

```dockerfile
RUN blender --background --python-expr "import bpy,sys; \
    sys.exit(0 if bpy.app.build_options.usd else 1)"
```

If a future Blender version drops USD or the tarball URL changes, the
build fails loudly instead of producing a silently-broken image.

## Local test (without a real VPS)

Requires Docker.

```bash
cd infra/converter
cp .env.example .env
# edit .env: STAMP_ID = your existing Bee postage batch
# edit .env: BEE_URL = http://host.docker.internal:1633 (works on Mac + Linux)

docker compose up --build

# in another terminal — convert an existing USDZ ref
curl -s "http://localhost:8082/convert?ref=38bc1d4b730b221b87a88e820266aee57e678e4a5d5f986f356693eafee9bc0a" | jq
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
# PORT=8082   (override if 8082 is taken)

docker compose up -d --build

# Health
curl http://localhost:8082/health
# → { "ok": true, "cached": 0 }
```

Open the converter port on the VPS firewall (`sudo ufw allow 8082/tcp`).

In the viewer's `.env.local` and Vercel env:

```
NEXT_PUBLIC_CONVERTER_URL=http://<vps-ip>:8082
```

The viewer's `[name]/page.tsx` checks if the contenthash is a Swarm
USDZ ref, calls `/convert?ref=…`, and uses the returned `glbRef` for
the in-canvas render. No on-chain or ENS records are touched — this
is a pure read-side conversion layer.

## Image size + cold start

- First build: pulls Ubuntu 24.04 + downloads Blender 4.5 LTS tarball
  (~400 MB compressed, ~1.5 GB extracted). Total image ~2 GB.
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
# inside the container
blender --background --python /app/convert.py -- /tmp/scene.usdz /tmp/scene.glb
```

A healthy run prints something like:

```
[convert.py] blender 4.5.0
[convert.py] build_options: usd=True io_gltf=True
[convert.py] cleaned: objects=0
[convert.py] import result: {'FINISHED'}  objects=42  meshes=18
[convert.py] export result: {'FINISHED'}
[convert.py] wrote 8421573 bytes to /tmp/scene.glb
```

If `usd=False` shows up — your image was built from the wrong Blender.
Rebuild from this Dockerfile, don't try to patch around it.
