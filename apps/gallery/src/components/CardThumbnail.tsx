/**
 * Type-based card thumbnail. Each capture mode gets a recognizable
 * isometric pictogram in the brand orange against a subtle warm
 * gradient — readable at glance, no scan-by-scan WebGL contexts on the
 * grid. The 3D preview itself is still mounted on click via
 * <CardScene> which sits absolutely over this surface.
 *
 * Why a fixed pictogram instead of a per-scan SSR snapshot:
 * - Per-scan thumbnails require server-side three.js or pre-baked PNGs
 *   on Swarm — both add infra that doesn't exist for the hackathon.
 * - Per-scan thumbnails for RoomPlan look indistinguishable from each
 *   other anyway (white-on-white planes silhouette identically).
 * - The real differentiator (the actual scan) is one click away.
 */
interface Props {
  mode: string | null;
  label: string;
}

export function CardThumbnail({ mode, label }: Props) {
  const kind = (mode ?? "").toLowerCase();
  const variant: Variant =
    kind === "roomplan" || kind === "room"
      ? "room"
      : kind === "objectcapture" || kind === "object"
        ? "object"
        : "generic";

  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden border-b border-[--color-rule]"
      role="img"
      aria-label={`${variant} capture preview for ${label}`}
    >
      {/* Warm dark gradient — subtle copper/orange wash at the top-right
          so the orange pictogram has a complementary background. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 80% 10%, oklch(0.30 0.05 58 / 0.55), transparent 55%), linear-gradient(180deg, oklch(0.21 0.014 250) 0%, oklch(0.16 0.012 250) 100%)",
        }}
      />

      {/* Faint dot grid for a "blueprint" feel — same on every card so
          the pictogram is what differentiates them, not the texture. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, oklch(0.97 0.008 85 / 0.10) 1px, transparent 0)",
          backgroundSize: "8px 8px",
        }}
      />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid meet"
        role="presentation"
      >
        <Pictogram variant={variant} />
      </svg>
    </div>
  );
}

type Variant = "room" | "object" | "generic";

function Pictogram({ variant }: { variant: Variant }) {
  // Single shared visual language: 1.5px orange strokes, no fills, no
  // shadows. Matches the per-proof page's mono-on-dark aesthetic.
  const stroke = "oklch(0.80 0.16 58)";
  const strokeFaint = "oklch(0.80 0.16 58 / 0.35)";

  if (variant === "room") {
    // Isometric floor plan — outer rectangle, one interior wall, a
    // door cutout. Reads as "apartment" without being literal.
    return (
      <g
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        transform="translate(80 60)"
      >
        {/* Floor (isometric parallelogram) */}
        <path d="M 0 90 L 110 30 L 240 90 L 130 150 Z" stroke={strokeFaint} />
        {/* Back wall */}
        <path d="M 0 90 L 110 30 L 110 -10 L 0 50 Z" />
        {/* Right wall */}
        <path d="M 110 30 L 240 90 L 240 50 L 110 -10 Z" />
        {/* Front-right wall (with door cutout) */}
        <path d="M 240 90 L 130 150 L 130 110 L 175 87" />
        <path d="M 195 77 L 240 50 L 240 90" />
        {/* Door opening hint */}
        <path
          d="M 175 87 L 175 127 L 195 117 L 195 77"
          stroke={strokeFaint}
        />
      </g>
    );
  }

  if (variant === "object") {
    // Isometric cube on a faint floor plane — reads as "object on
    // surface", which is what Object Capture produces.
    return (
      <g
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        transform="translate(120 70)"
      >
        {/* Faint floor disc — gives the cube somewhere to sit */}
        <ellipse
          cx="80"
          cy="160"
          rx="120"
          ry="22"
          stroke={strokeFaint}
          strokeWidth="1.5"
        />
        {/* Top face */}
        <path d="M 80 30 L 160 70 L 80 110 L 0 70 Z" />
        {/* Left face */}
        <path d="M 0 70 L 80 110 L 80 170 L 0 130 Z" />
        {/* Right face */}
        <path d="M 160 70 L 80 110 L 80 170 L 160 130 Z" />
        {/* Top X for visual interest — looks like a wireframe hint */}
        <path d="M 0 70 L 160 70 M 80 30 L 80 110" stroke={strokeFaint} />
      </g>
    );
  }

  // Generic / unknown — a simple ◆ glyph centered, same as the brand
  // hero. Better than a random gradient blob.
  return (
    <g
      fill="none"
      stroke={stroke}
      strokeWidth="2.5"
      strokeLinejoin="round"
      transform="translate(170 90)"
    >
      <path d="M 30 0 L 60 60 L 30 120 L 0 60 Z" />
      <path d="M 30 30 L 45 60 L 30 90 L 15 60 Z" stroke={strokeFaint} />
    </g>
  );
}
