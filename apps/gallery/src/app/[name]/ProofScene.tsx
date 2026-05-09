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
        className="aspect-[16/10] w-full rounded-[20px] border border-[--color-rule] bg-[--color-surface-sunk]"
      />
    );
  }

  if (error) {
    return (
      <div className="rounded-[20px] border border-[--color-rule] bg-[--color-surface-raised] px-6 py-10 text-center">
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

  // Two material tweaks applied on GLB load to make RoomPlan scans
  // render correctly:
  //
  // 1. Double-sided rendering. RoomPlan exports walls as single-sided
  //    planes facing inward; without this, the auto-framed camera
  //    sitting outside the bounding box sees only backfaces and the
  //    room collapses to a floor plane.
  //
  // 2. Polygon offset. RoomPlan's USD also emits overlapping coplanar
  //    geometry (e.g. wall+ceiling sharing the exact same edge plane,
  //    inner+outer wall faces at near-identical depth), and Blender's
  //    USD→GLB doesn't dedupe it. Two surfaces fighting for the same
  //    pixel produces the white-flickering "stuck" texels along corners
  //    you've been seeing — that's z-fighting. polygonOffset nudges
  //    depth values by a slope-proportional amount, breaking the tie
  //    cleanly. We reach into model-viewer's underlying three.js
  //    Material via its internal symbol; best effort, fails silently
  //    if the API moves between versions.
  //
  // Both are safe no-ops for object captures (closed-hull meshes with
  // no coplanar duplicates), so we apply them unconditionally.
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
        for (const m of mats) {
          m.setDoubleSided?.(true);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tm: any =
            m[Symbol.for("material")] ??
            m.threeMaterial ??
            m._material;
          if (tm) {
            tm.polygonOffset = true;
            tm.polygonOffsetFactor = 1;
            tm.polygonOffsetUnits = 1;
            tm.needsUpdate = true;
          }
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
  }, [url]);

  return (
    <div className="overflow-hidden rounded-[20px] border border-[--color-rule] bg-[--color-surface-raised] p-2">
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
          exposure: "1.0",
          "shadow-intensity": "1",
          "shadow-softness": isRoom ? "0.5" : "0.6",
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
            borderRadius: "16px",
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
    <div className="rounded-[20px] border border-[--color-rule] bg-[--color-surface-raised] p-10 text-center">
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
    <p className="px-2 pt-2 text-mono-s">
      <span style={{ color: "var(--color-accent)" }}>Captured by</span>{" "}
      <a
        href={`https://sepolia.basescan.org/address/${attestor}`}
        target="_blank"
        rel="noreferrer"
        className="font-mono underline decoration-current/40 underline-offset-4 hover:decoration-current"
        style={{ color: "var(--color-link)" }}
      >
        {attestor.slice(0, 8)}…{attestor.slice(-6)}
      </a>
    </p>
  );
}
