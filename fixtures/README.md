# Demo fixtures

3D assets for end-to-end smoke tests. Not committed (binary, ~MBs) —
fetch on demand:

```bash
# Khronos Damaged Helmet (the canonical PBR test asset, ~3.7 MB GLB)
mkdir -p fixtures
curl -fsSL -o fixtures/damaged-helmet.glb \
  https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb
```

Use with smoke-mint:

```bash
SCENE_FILE=$PWD/fixtures/damaged-helmet.glb \
  pnpm --filter @proof-of-reality/api exec tsx scripts/smoke-mint.ts
```

## Other tested assets

| File | Source | Size | Format | Notes |
|---|---|---|---|---|
| `damaged-helmet.glb` | [Khronos glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/DamagedHelmet) | 3.7 MB | GLB | PBR; renders in any glTF viewer + model-viewer + Blender |
| `toy-robot.usdz` | [Apple AR Quick Look gallery](https://developer.apple.com/augmented-reality/quick-look/) | 7.3 MB | USDZ | Renders directly in Safari + iOS QuickLook |

For Apple's USDZ samples, save manually from the link (they don't allow
direct curl due to anti-hotlinking).
