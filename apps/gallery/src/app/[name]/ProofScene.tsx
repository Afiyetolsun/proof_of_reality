"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

interface Props {
  url: string;
  attestor?: string;
  /**
   * Capture mode from the proof bundle. Drives <model-viewer> lighting:
   * room scans (white walls, no textures) need a sharp shadow + low
   * exposure so corners read as separate surfaces; object scans look
   * best with a softer shadow at default exposure.
   */
  mode?: string;
}

type SceneFormat = "glb" | "usdz" | "unknown";

/**
 * 3D scene preview for the per-name page.
 *
 * The server-side converter (lib/converter.ts) rewrites Swarm USDZ refs
 * to their cached GLB equivalents before the page mounts, so by the
 * time we get here `url` is virtually always a GLB. The USDZ fallback
 * stays around for the cases the converter couldn't handle (offline,
 * unsupported USD construct, etc): we surface a static QuickLook card
 * instead of spinning up Pixar's USD WASM in the browser, which is
 * fragile across browsers and adds 9 MB to the bundle for a worse
 * render than QuickLook would give natively.
 *
 * Mounted client-side only so <model-viewer>'s ar-status mutation
 * doesn't trigger a hydration mismatch.
 */
export function ProofScene({ url, attestor, mode }: Props) {
  const [mounted, setMounted] = useState(false);
  const [format, setFormat] = useState<SceneFormat>("unknown");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    let cancelled = false;
    fetch(url, { method: "HEAD" })
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) {
          setError(`scene fetch returned ${r.status}`);
          return;
        }
        const ct = (r.headers.get("content-type") ?? "").toLowerCase();
        const cd = r.headers.get("content-disposition") ?? "";
        const filename = /filename="?([^";]+)"?/.exec(cd)?.[1] ?? "";
        const ext = filename.toLowerCase().split(".").pop() ?? "";
        if (ct.includes("usdz") || ct.includes("usd") || ext === "usdz") {
          setFormat("usdz");
        } else if (
          ct.includes("gltf") ||
          ct.includes("glb") ||
          ext === "glb" ||
          ext === "gltf"
        ) {
          setFormat("glb");
        } else {
          // Default to GLB-attempt; model-viewer will at least try.
          setFormat("glb");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!mounted || (!error && format === "unknown")) {
    return (
      <div
        aria-hidden
        className="aspect-[16/10] w-full border border-[--color-rule] bg-[--color-surface-sunk]"
      />
    );
  }

  if (error) {
    return (
      <div className="border border-[--color-rule] bg-[--color-surface-raised] px-6 py-10 text-center">
        <div className="text-eyebrow font-mono text-[--color-warn]">scene unavailable</div>
        <p className="mt-2 text-mono-s text-[--color-ink-mute]">{error}</p>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block text-mono-s text-[--color-signal] underline decoration-transparent underline-offset-4 hover:decoration-[--color-signal]"
        >
          Try opening directly ↗
        </a>
      </div>
    );
  }

  if (format === "usdz") {
    return <UsdzCard url={url} attestor={attestor} />;
  }
  return <GlbCard url={url} attestor={attestor} mode={mode} />;
}

function GlbCard({
  url,
  attestor,
  mode,
}: {
  url: string;
  attestor?: string;
  mode?: string;
}) {
  const isRoom = mode === "roomPlan" || mode === "room";
  const ref = useRef<HTMLElement | null>(null);

  // Two surgeries on the GLB at load time:
  //
  // 1. Force every material double-sided. RoomPlan exports walls as
  //    single-sided planes facing inward, so when model-viewer's
  //    auto-framing drops the camera outside the bounding box, every
  //    wall is backface-culled and only the floor survives.
  //
  // 2. Tint each material a slightly different shade. The unsolvable
  //    problem with white-on-white room scans is that adjacent walls
  //    reflect the IBL identically — same brightness on both sides of
  //    a corner means the corner seam is literally not in the rendered
  //    image. Real architectural viz fixes this with baked AO; we
  //    don't have AO, but if floor/wall/ceiling each get a distinct
  //    calm hue, the seams pop on their own. Tints are low-saturation
  //    so it still reads as "white room" rather than a rainbow.
  //    Heuristic: name-match floor/ceiling/wall first, then fall back
  //    to assigning by index from a calm palette.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const onLoad = () => {
      if (cancelled) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mv = el as any;
      try {
        const mats = mv.model?.materials ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const m of mats) m.setDoubleSided?.(true);

        if (isRoom && mats.length > 0) {
          type RGBA = [number, number, number, number];
          const FLOOR: RGBA = [0.86, 0.80, 0.70, 1];     // warm beige
          const CEILING: RGBA = [0.72, 0.74, 0.76, 1];   // light slate
          const WALLS: RGBA[] = [
            [0.94, 0.94, 0.96, 1],                       // cool white
            [0.78, 0.80, 0.84, 1],                       // pale blue-grey
            [0.88, 0.86, 0.82, 1],                       // soft cream
          ];
          const FALLBACK: RGBA[] = [...WALLS, FLOOR, CEILING, [0.90, 0.86, 0.78, 1]];
          const pick = (arr: RGBA[], i: number): RGBA => arr[i % arr.length] ?? arr[0]!;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mats.forEach((m: any, i: number) => {
            const name = (m.name ?? "").toLowerCase();
            let color: RGBA;
            if (/floor|ground/.test(name)) color = FLOOR;
            else if (/ceil/.test(name)) color = CEILING;
            else if (/wall/.test(name)) color = pick(WALLS, i);
            else color = pick(FALLBACK, i);
            try {
              m.pbrMetallicRoughness?.setBaseColorFactor?.(color);
            } catch {
              /* material API might be locked, skip */
            }
          });
        }
      } catch (e) {
        console.warn("[scene] post-load material tweak failed", e);
      }
    };
    el.addEventListener("load", onLoad);
    return () => {
      cancelled = true;
      el.removeEventListener("load", onLoad);
    };
  }, [url, isRoom]);

  return (
    <div className="border border-[--color-rule] bg-[--color-surface-raised] p-2">
      <Script type="module" src="/model-viewer.min.js" strategy="lazyOnload" />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <model-viewer
        {...({
          ref,
          src: url,
          alt: "Captured 3D scene",
          "camera-controls": "",
          "auto-rotate": "",
          "auto-rotate-delay": "1500",
          "rotation-per-second": "20deg",
          // IBL via a built-in neutral HDRI — without it, untextured
          // PBR materials (every wall in a RoomPlan capture) read as a
          // single flat shade and you can't see geometry edges.
          "environment-image": "neutral",
          "tone-mapping": "aces",
          // Lower exposure for rooms so shadows + AO read against
          // white walls instead of getting washed out by IBL.
          exposure: isRoom ? "0.7" : "1.0",
          "shadow-intensity": "1",
          // Sharp shadow on rooms gives corner contrast that defines
          // adjacent walls; softer shadow on objects looks more natural.
          "shadow-softness": isRoom ? "0.25" : "0.6",
          // Lift the camera slightly for room scans so we look down
          // into the floor plan.
          ...(isRoom ? { "camera-orbit": "25deg 65deg auto" } : {}),
          "interaction-prompt": "auto",
          ar: "",
          "ar-modes": "scene-viewer webxr quick-look",
          "ios-src": url,
          loading: "eager",
          style: {
            width: "100%",
            height: "min(60vh, 520px)",
            background: "oklch(0.13 0.012 250)",
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)}
      />
      <Caption attestor={attestor} />
    </div>
  );
}

/**
 * USDZ preview card. Reached only when the converter couldn't produce
 * a GLB (offline, unsupported USD, etc). On Apple devices `<a rel="ar">`
 * triggers QuickLook; everywhere else it downloads the .usdz file.
 */
function UsdzCard({ url, attestor }: { url: string; attestor?: string }) {
  const isApple =
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

  return (
    <div className="border border-[--color-rule] bg-[--color-surface-raised] p-10 text-center">
      <div
        aria-hidden
        className="mx-auto mb-4 text-[44px] leading-none"
        style={{ filter: "drop-shadow(0 4px 24px oklch(0.74 0.14 58 / 0.30))" }}
      >
        ◆
      </div>
      <div className="text-eyebrow font-mono uppercase tracking-[0.14em] text-[--color-ink-mute]">
        USDZ scene
      </div>
      <p className="mx-auto mt-3 max-w-[44ch] text-body-s text-[--color-ink-mute]">
        {isApple
          ? "Tap below to open the 3D capture in QuickLook — orbit, scale, and place in your room with AR."
          : "Apple's native 3D format. Open on iPhone, iPad, or Mac for AR + QuickLook preview, or download to view in your USDZ tool of choice."}
      </p>
      <a
        href={url}
        rel={isApple ? "ar" : undefined}
        download={!isApple ? "scene.usdz" : undefined}
        className="mt-6 inline-block rounded-full bg-[--color-signal] px-6 py-3 text-mono-s font-semibold text-[--color-surface-deep]"
      >
        {isApple ? "Open in QuickLook" : "Download .usdz"}
      </a>
      <div className="mt-6">
        <Caption attestor={attestor} />
      </div>
    </div>
  );
}

function Caption({ attestor }: { attestor?: string }) {
  if (!attestor) return null;
  return (
    <p className="text-mono-s text-[--color-ink-mute]">
      Captured by{" "}
      <a
        href={`https://sepolia.basescan.org/address/${attestor}`}
        target="_blank"
        rel="noreferrer"
        className="text-mono text-[--color-ink] underline decoration-transparent underline-offset-4 hover:decoration-[--color-signal]"
      >
        {attestor.slice(0, 8)}…{attestor.slice(-6)}
      </a>
    </p>
  );
}
