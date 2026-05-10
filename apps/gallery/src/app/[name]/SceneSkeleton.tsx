/**
 * Loading state for <ProofScene>. Shown via <Suspense> while the
 * server-side USDZ→GLB conversion is mid-flight (cache miss → Blender
 * runs ~5–15 s). Same rounded-[20px] envelope as the real scene card
 * so the layout doesn't jump when the GLB streams in.
 *
 * Pure server component — the spinner is CSS only, no JS, so it shows
 * even on a hydration delay.
 */
export function SceneSkeleton() {
  return (
    <div
      className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-[20px] border border-[--color-rule] bg-[--color-surface-sunk]"
      role="status"
      aria-label="Loading 3D scene"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <Spinner />
        <div className="text-eyebrow font-mono uppercase tracking-[0.14em] text-[--color-ink-mute]">
          Preparing scene
        </div>
        <p className="max-w-[42ch] px-4 text-mono-s text-[--color-ink-faint]">
          First-time captures are converted from USDZ to GLB on our render
          node. ~10 s. Subsequent visits are instant.
        </p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div
      aria-hidden
      className="h-12 w-12 animate-spin rounded-full"
      style={{
        // Conic gradient spinner — orange (--color-signal) sweep
        // against transparent. Matches the brand without needing an
        // SVG file.
        background:
          "conic-gradient(from 0deg, oklch(0.74 0.14 58 / 0) 0deg, oklch(0.74 0.14 58 / 0) 240deg, oklch(0.80 0.16 58) 360deg)",
        mask: "radial-gradient(circle, transparent 14px, black 16px)",
        WebkitMask: "radial-gradient(circle, transparent 14px, black 16px)",
      }}
    />
  );
}
