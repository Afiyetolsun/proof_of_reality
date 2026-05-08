# Proof of Reality — Design

> Token reference and component conventions for the brand surfaces.

## Theme

Dark, low-chroma, type-led. The scene is a tired judge on a 14" laptop in a dim Municipal House mezzanine at 6pm. They need to land somewhere quiet that signals technical seriousness in the first second.

## Color (OKLCH)

| Token | OKLCH | CSS var |
|---|---|---|
| `surface.deep` | `oklch(0.16 0.012 250)` | `--surface-deep` |
| `surface.raised` | `oklch(0.21 0.014 250)` | `--surface-raised` |
| `surface.ink` | `oklch(0.97 0.008 85)` | `--ink` |
| `surface.ink-mute` | `oklch(0.74 0.012 85)` | `--ink-mute` |
| `surface.rule` | `oklch(0.30 0.014 250)` | `--rule` |
| `signal` | `oklch(0.74 0.14 58)` | `--signal` |
| `signal.deep` | `oklch(0.62 0.16 58)` | `--signal-deep` |
| `warn` | `oklch(0.62 0.16 28)` | `--warn` |

**Strategy: Committed.** `signal` (copper) carries ~30% of visible surface across the page. CTAs, verified states, the cosmic-nonce ticker, signature blocks. No per-section accent rotation. No `#fff`, no `#000`.

`warn` (red-orange copper) is reserved for the AI-vs-real reject demo. Nothing else.

## Typography

- **Sans (display + body):** Geist (variable), via `next/font`.
- **Mono:** Geist Mono. Used as a visual signature: hashes, addresses, nonces, contract IDs. At least one mono block per page.
- **Editorial italic:** Newsreader (italic, weight 400). Used exactly once, for the SpaceComputer pull-quote.

### Scale

| Step | Size | Use |
|---|---|---|
| Display XL | `clamp(3.5rem, 7vw, 7rem)` / line-height `0.95` / tracking `-0.025em` | Hero only |
| Display L | `clamp(2.5rem, 4.5vw, 4rem)` / line-height `1.0` / tracking `-0.02em` | Section openers |
| H2 | `1.875rem` / line-height `1.15` / tracking `-0.01em` | Sub-blocks |
| Body | `1.0625rem` (17px) / line-height `1.6` | Primary read, max 65ch |
| Body-S | `0.9375rem` (15px) / line-height `1.55` | Footnotes |
| Mono | `0.9375rem` / line-height `1.5` / tracking `-0.005em` | Hashes, addresses |
| Eyebrow | `0.75rem` / uppercase / tracking `+0.14em` | Section labels |

## Spacing

Container: `max-w-[88rem]` (1408px). Gutter: `clamp(1.25rem, 4vw, 3rem)`. Section padding: vary deliberately, do not flatten. Hairline rules between sections (1px `--rule`, 30% opacity), not big padding gaps.

## Layout

Asymmetric 12-column grid. Most sections anchor type to the left at column 1, content to columns 5–12. One full-bleed section per page maximum.

## Motion

- Section reveals: 240ms `ease-out-quart` (cubic-bezier `0.165, 0.84, 0.44, 1`), 14px translate-y. No springs. No bounce. No elastic.
- Splat orbit: 0.04 rad/s. Cursor proximity nudges ±15%.
- Nonce ticker: 40 px/s leftward marquee. Flicker on new value: opacity 1 → 0.4 → 1 over 200ms.
- Witness diagram signal arcs: 80ms stagger, 600ms total draw-in on scroll-into-view.
- `prefers-reduced-motion: reduce`: ticker frozen with latest value, splat frozen, arcs in final state.

## Components

### Section

```tsx
<Section eyebrow="WITNESSES" display="Five witnesses on every scan">
  <p>...</p>
</Section>
```

Renders eyebrow + display + children. Asymmetric grid built in.

### CTAButton

Two variants: `filled` (signal background, surface-deep text) and `ghost` (no background, ink text, signal underline on hover). Always renders as `<a>` — internal-link affordance over button-shaped link.

### Mono

Wraps a hash, address, or nonce in `font-mono`, with `letter-spacing: -0.005em`, opacity 0.92, and an optional tooltip showing the full string when truncated.

### Eyebrow

Uppercase, +0.14em tracking, `--ink-mute` color, `--signal` for high-emphasis section markers.

## Iconography & ornament

No icon system. Section anchors are SVGs custom-drawn for each section (the witness blocks have five distinct silhouettes; never an emoji or a Heroicon).

## A11y

- Body contrast: WCAG AAA against `surface.deep` (verified via OKLCH math).
- Focus: 2px `--signal` outline, 4px offset.
- Hit targets ≥ 44×44px on touch.
- Skip-to-content link at the top of `layout.tsx`.

## Out of scope

Component library. Storybook. Light theme. Mobile drawer nav (the page is short enough not to need one).
