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

type SceneFormat = "glb" | "usdz" | "unsupported" | "unknown";

/**
 * Content-type / extension hints that we *recognize* but can't render
 * in <model-viewer>. Hitting any of these means the contenthash points
 * at a raw 3D capture format (PLY mesh, OBJ, raw USD ASCII, …) that
 * the server-side converter couldn't downcast to GLB. We need to
 * detect them explicitly because letting <model-viewer> try to load
 * them produces a noisy `THREE.GLTFLoader: Unsupported asset` console
 * error that surfaces in the Next.js dev overlay.
 */
const UNSUPPORTED_SCENE_HINTS = [
  "ply",         // Polygon File Format (Object Capture intermediate)
  "obj",         // Wavefront OBJ
  "stl",         // Stereolithography
  "fbx",         // Autodesk FBX
  "octet-stream", // generic binary, with a non-glb/usdz extension
];

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
        if (ct.includes("usdz") || ext === "usdz") {
          setFormat("usdz");
        } else if (
          ct.includes("gltf") ||
          ct.includes("glb") ||
          ext === "glb" ||
          ext === "gltf"
        ) {
          setFormat("glb");
        } else if (
          UNSUPPORTED_SCENE_HINTS.some((h) => ct.includes(h)) ||
          ["ply", "obj", "stl", "fbx", "usd", "usda", "usdc"].includes(ext)
        ) {
          // Known 3D format we can't render in <model-viewer>. Show a
          // dedicated card instead of falling through to a noisy
          // GLTFLoader error.
          setFormat("unsupported");
        } else {
          // Truly unknown — assume GLB and let model-viewer try.
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
  if (format === "unsupported") {
    return <UnsupportedCard url={url} attestor={attestor} />;
  }
  return <GlbCard url={url} attestor={attestor} mode={mode} />;
}

/**
 * Fallback for known 3D formats we can't render in-canvas (PLY, OBJ,
 * raw USD ASCII, etc). Surfaces a clear "download to view" CTA
 * instead of letting model-viewer's GLTFLoader log
 * "Unsupported asset. glTF versions >=2.0 are supported." into the
 * dev console.
 */
function UnsupportedCard({ url, attestor }: { url: string; attestor?: string }) {
  return (
    <div className="rounded-[20px] border border-[--color-rule] bg-[--color-surface-raised] p-10 text-center">
      <div
        aria-hidden
        className="mx-auto mb-4 text-[44px] leading-none text-[--color-signal]"
        style={{ filter: "drop-shadow(0 4px 24px oklch(0.74 0.14 58 / 0.30))" }}
      >
        ◆
      </div>
      <div className="text-eyebrow font-mono uppercase tracking-[0.14em] text-[--color-ink-mute]">
        3D scene
      </div>
      <p className="mx-auto mt-3 max-w-[44ch] text-body-s text-[--color-ink-mute]">
        This capture is in a 3D format the in-browser viewer doesn&apos;t support
        (PLY, OBJ, raw USD, etc). Download it to open in Blender, Maya,
        QuickLook, or your tool of choice.
      </p>
      <a
        href={url}
        download
        className="mt-6 inline-block rounded-full bg-[--color-signal] px-6 py-3 text-mono-s font-semibold text-[--color-surface-deep]"
      >
        Download scene
      </a>
      <div className="mt-6">
        <Caption attestor={attestor} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Room-scan render tuning. Tweak these to taste — they're the only
// numbers you have to edit to change how RoomPlan captures look.
// ─────────────────────────────────────────────────────────────────────
//
// ROOM_BASE_COLOR: linear-RGB-A (0..1). The flat color every wall /
// floor / ceiling material gets painted with in `roomPlan` mode.
// Dark + neutral makes the IBL contribution the dominant signal at
// every face, which is what produces visible corner steps. Brightening
// this wipes the corners back out (bright surfaces saturate). For a
// warmer apartment feel try [0.32, 0.30, 0.27, 1].
const ROOM_BASE_COLOR: [number, number, number, number] = [0.22, 0.24, 0.27, 1];

// ROOM_ROUGHNESS: 0 = mirror, 1 = matte. Forced to 1 because RoomPlan
// USDZ sometimes imports as glossy plastic which catches specular and
// washes out edge contrast.
const ROOM_ROUGHNESS = 1;

// ROOM_EXPOSURE: model-viewer `exposure` attribute for room scans.
// Lower values darken the whole scene so corner shadows read against
// the dark base color. Object captures get their own default below.
const ROOM_EXPOSURE = "0.85";

// ROOM_SHADOW_INTENSITY / ROOM_SHADOW_SOFTNESS: model-viewer's ground
// shadow. A sharp shadow under the room places it in space and adds
// another tonal layer.
const ROOM_SHADOW_INTENSITY = "1";
const ROOM_SHADOW_SOFTNESS = "0.4";

// OBJECT_EXPOSURE / OBJECT_SHADOW_*: same knobs for object captures
// (textured photogrammetry — needs different treatment).
const OBJECT_EXPOSURE = "1.0";
const OBJECT_SHADOW_INTENSITY = "1";
const OBJECT_SHADOW_SOFTNESS = "0.6";

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

  // Material tweaks applied on GLB load. Uses only model-viewer's
  // PUBLIC material API (`mv.model.materials[i]`) — no traversal of
  // the internal three.js scene, which broke between model-viewer
  // versions and silently no-op'd, leaving room scans rendering
  // uniformly white.
  //
  // For every material we:
  //  1. Force double-sided rendering. RoomPlan exports walls as
  //     single-sided planes facing inward; without this, the
  //     auto-framed camera sitting outside the bounding box only sees
  //     backfaces and the room collapses to a floor plane.
  //
  // For room scans only we additionally:
  //  2. Set every base color factor to a dark cool slate. The reason
  //     white-on-white rooms look like a single solid hull is that PBR
  //     on equally-bright planar surfaces gives no luminance step at
  //     corners. Dark + matte (roughness=1) reverses this — IBL +
  //     shadow then produce strong dark/light corner transitions
  //     because a corner is the one place where the local normal
  //     turns 90° and the radiance integral changes a lot.
  //  3. Push roughness to 1 (matte) and metallic to 0. RoomPlan
  //     materials sometimes import as low-roughness which catches
  //     specular and washes the geometry out.
  //
  // Configuration knobs live below as `ROOM_*` constants — tweak the
  // base color and roughness numbers to taste.
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
        mats.forEach((m: any) => {
          m.setDoubleSided?.(true);
          if (!isRoom) return;
          // Public material API only — works regardless of which
          // model-viewer version is loaded.
          try {
            m.pbrMetallicRoughness?.setBaseColorFactor?.(ROOM_BASE_COLOR);
            m.pbrMetallicRoughness?.setRoughnessFactor?.(ROOM_ROUGHNESS);
            m.pbrMetallicRoughness?.setMetallicFactor?.(0);
          } catch {
            /* material API may be locked on some glTF imports — skip */
          }
        });
      } catch (e) {
        console.warn("[scene] material tweak failed", e);
      }
    };
    el.addEventListener("load", onLoad);
    return () => {
      cancelled = true;
      el.removeEventListener("load", onLoad);
    };
  }, [url, isRoom]);

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
          exposure: isRoom ? ROOM_EXPOSURE : OBJECT_EXPOSURE,
          "shadow-intensity": isRoom ? ROOM_SHADOW_INTENSITY : OBJECT_SHADOW_INTENSITY,
          "shadow-softness": isRoom ? ROOM_SHADOW_SOFTNESS : OBJECT_SHADOW_SOFTNESS,
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
