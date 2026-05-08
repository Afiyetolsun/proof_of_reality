# @proof-of-reality/landing

Marketing surface for Proof of Reality. Next.js 15, Tailwind 4, Geist, deployed on Vercel.

The landing is the first thing a judge or partner sees. It is **separate** from the verifier (`apps/viewer/`) by design — different audience, different evolution velocity, different deploy.

## Routes

| Path | Purpose |
|---|---|
| `/` | Landing — 8 sections, live splat hero, live cosmic-nonce ticker |
| `/api/nonce` | Edge proxy → `apps/api` `POST /api/nonce`, with graceful fallback when the API is unreachable |

## Dev

```bash
# from repo root
pnpm install                    # workspace deps (one-time)
pnpm dev:landing                # boots on :3001
```

For a "LIVE" cosmic-nonce ticker (instead of "FALLBACK"), boot the backend in a second terminal:

```bash
cp apps/landing/.env.example apps/landing/.env.local   # edit if needed
pnpm dev:api                                           # PROOF_API_URL → http://localhost:3000
```

## Environment

All four are optional — the page falls back gracefully without them.

| Var | Scope | Purpose |
|---|---|---|
| `PROOF_API_URL` | server | Origin of `apps/api`. Drives the live nonce proxy. Without it the ticker shows a static fallback nonce. |
| `NEXT_PUBLIC_VIEWER_BASE_URL` | client | Origin of `apps/viewer`. Used to build deep-links from CTAs. |
| `NEXT_PUBLIC_SAMPLE_TOKEN_ID` | client | Real minted token id on Base Sepolia. CTA falls back to viewer root if unset. |
| `NEXT_PUBLIC_GITHUB_URL` | client | GitHub repo URL for the "Architecture" link and footer. |

## Splat asset

The hero embeds a real Gaussian splat from `public/splat/scene.ksplat` via [`@mkkellogg/gaussian-splats-3d`](https://github.com/mkkellogg/GaussianSplats3D). The asset is quantized via `scripts/convert-splat.mjs`:

```bash
# input is .ply or .splat; output is .ksplat (~10x smaller, 330k splats compressed)
node apps/landing/scripts/convert-splat.mjs <input.ply> apps/landing/public/splat/scene.ksplat 1
```

The third arg is compression level (`0` = none, `1` = quantized — current default, `2` = aggressive). Keep `compression=1` unless the result has visible artifacts. The viewer auto-detects format from the file extension.

To swap the splat, replace `public/splat/scene.ksplat` and adjust `initialCameraPosition` / `cameraUp` in `src/components/PlyHero.tsx` to frame the new scene.

## Deploy

Per-app `vercel.json` is in place (`framework: nextjs`, `regions: ["fra1"]`). Two paths:

```bash
# CLI
cd apps/landing
vercel                      # preview
vercel --prod               # production
```

Or import the repo on vercel.com with **Root Directory = `apps/landing`**. The pnpm lockfile in the repo root is auto-detected; workspace deps resolve correctly.

After deploy, set the four env vars above in **Project → Settings → Environment Variables** and redeploy.

## Conventions

This app follows `DESIGN.md` (root) for tokens and component conventions, and `PRODUCT.md` (root) for voice and anti-references. Read both before writing new sections — copy lives close to the visual identity.

- No `#fff`, no `#000`. Use OKLCH tokens from `globals.css`.
- No glassmorphism, no gradient text, no em dashes, no hero metric template.
- Every page renders at least one mono-typeset cryptographic string. It's a visual signature.

## Files of note

- `src/app/page.tsx` — composes the 8 sections.
- `src/components/PlyHero.tsx` — splat viewer; lazy-loads three + gaussian-splats-3d.
- `src/components/HeroOrbital.tsx` — SVG placeholder shown until the splat streams in.
- `src/components/NonceTicker.tsx` — top-of-page live cosmic-nonce marquee.
- `src/components/WitnessDiagram.tsx` — five witnesses, scroll-driven draw-in.
- `src/app/api/nonce/route.ts` — edge proxy with 4.5s timeout and fallback.
- `src/app/globals.css` — OKLCH tokens, type scale, motion vars.
