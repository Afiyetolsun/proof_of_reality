/**
 * Hash-derived thumbnail. We don't render USDZ inline on cards (Pixar's
 * USD WASM is heavy and needs cross-origin isolation; the per-name
 * viewer handles it). Instead the thumbnail is a deterministic
 * gradient + abstract sigil derived from the bundleHash, so each scan
 * gets a unique-looking surface that the user can recognize after
 * they've seen it once.
 *
 * The sigil is two offset orbs (a nod to "physical object + orbital
 * witness") whose radii / placement come from hash bytes. No randomness,
 * no fetches.
 */
import type { Hex } from "viem";

interface Props {
  bundleHash: Hex | null;
  contentRef: string | null;
  label: string;
}

export function CardThumbnail({ bundleHash, contentRef, label }: Props) {
  const seed = bundleHash ?? (contentRef ? `0x${contentRef.slice(0, 64)}` : null);
  const t = seed ? seedToTokens(seed) : neutralTokens(label);

  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden border-b border-[--color-rule]"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(${t.gradAngle}deg, ${t.bg1} 0%, ${t.bg2} 100%)`,
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
        role="presentation"
      >
        <defs>
          <radialGradient id={`g-${t.id}-1`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={t.orb1} stopOpacity="0.85" />
            <stop offset="60%" stopColor={t.orb1} stopOpacity="0.25" />
            <stop offset="100%" stopColor={t.orb1} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`g-${t.id}-2`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={t.orb2} stopOpacity="0.7" />
            <stop offset="70%" stopColor={t.orb2} stopOpacity="0.15" />
            <stop offset="100%" stopColor={t.orb2} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={t.c1x} cy={t.c1y} r={t.r1} fill={`url(#g-${t.id}-1)`} />
        <circle cx={t.c2x} cy={t.c2y} r={t.r2} fill={`url(#g-${t.id}-2)`} />
        {/* Hairline ring — the "orbital" cue */}
        <circle
          cx={t.c1x}
          cy={t.c1y}
          r={t.r1 + 18}
          fill="none"
          stroke={t.orb1}
          strokeOpacity="0.18"
          strokeWidth="1"
        />
      </svg>

      {/* Subtle grain so the gradient doesn't look like SaaS slop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, oklch(0.97 0.008 85 / 0.12) 1px, transparent 0)",
          backgroundSize: "3px 3px",
        }}
      />
    </div>
  );
}

interface Tokens {
  id: string;
  bg1: string;
  bg2: string;
  orb1: string;
  orb2: string;
  gradAngle: number;
  c1x: number;
  c1y: number;
  r1: number;
  c2x: number;
  c2y: number;
  r2: number;
}

function seedToTokens(seed: string): Tokens {
  const hex = seed.replace(/^0x/, "");
  const b = (i: number) => parseInt(hex.slice(i * 2, i * 2 + 2), 16) || 0;

  // Hue families anchored to the brand palette: signal copper (50–80),
  // a deep blue companion (220–260), and a muted teal (160–200). Pick
  // two distinct families so we never get a same-hue card.
  const hueA = pickHue(b(0));
  const hueB = pickHueExcluding(b(1), hueA);

  const bg1 = `oklch(0.20 0.02 ${hueA})`;
  const bg2 = `oklch(0.13 0.018 ${hueB})`;
  const orb1 = `oklch(0.62 0.14 ${hueA})`;
  const orb2 = `oklch(0.55 0.12 ${hueB})`;

  const gradAngle = (b(2) % 90) + 130; // 130–219, top-leftish drift
  const c1x = 80 + (b(3) % 240);
  const c1y = 40 + (b(4) % 220);
  const r1 = 80 + (b(5) % 80);
  const c2x = 60 + (b(6) % 280);
  const c2y = 30 + (b(7) % 240);
  const r2 = 50 + (b(8) % 90);

  return { id: hex.slice(0, 6), bg1, bg2, orb1, orb2, gradAngle, c1x, c1y, r1, c2x, c2y, r2 };
}

function neutralTokens(label: string): Tokens {
  // Fallback for records without bundleHash or contenthash. Hash the
  // label so even unhydrated rows get a stable visual.
  let h = 5381;
  for (let i = 0; i < label.length; i++) h = ((h << 5) + h + label.charCodeAt(i)) | 0;
  const seed = (Math.abs(h).toString(16) + "0".repeat(64)).slice(0, 64);
  return seedToTokens(`0x${seed}`);
}

function pickHue(byte: number): number {
  const family = byte % 3;
  const offset = byte & 0x1f;
  if (family === 0) return 50 + (offset % 30); // copper 50–79
  if (family === 1) return 220 + (offset % 40); // deep blue 220–259
  return 160 + (offset % 40); // teal 160–199
}
function pickHueExcluding(byte: number, other: number): number {
  let h = pickHue(byte);
  if (Math.abs(h - other) < 30) h = (h + 80) % 360;
  return h;
}
