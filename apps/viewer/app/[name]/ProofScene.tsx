"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

interface Props {
  url: string;
  attestor?: string;
}

type SceneFormat = "glb" | "usdz" | "unknown";

/**
 * 3D scene preview. Detects the file format (GLB vs USDZ) by HEAD-ing
 * the proxy and rendering the right viewer:
 *
 *   GLB / glTF → <model-viewer> in-canvas (works everywhere, with
 *                 orbit / zoom / pan + AR mode on supported devices)
 *   USDZ       → static preview card with a big "Open in QuickLook"
 *                 button. <model-viewer>'s three.js has no USD loader
 *                 so it would just paint a black canvas. QuickLook
 *                 itself is iOS-only — desktop users see "Open file"
 *                 which downloads it.
 *
 * Mounted entirely client-side (after hydration) to avoid a hydration
 * mismatch from <model-viewer> writing ar-status="not-presenting" on
 * mount.
 */
export function ProofScene({ url, attestor }: Props) {
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
        } else if (ct.includes("gltf") || ct.includes("glb") || ext === "glb" || ext === "gltf") {
          setFormat("glb");
        } else {
          // Default to glb-attempt; model-viewer will at least try
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

  if (!mounted) {
    // Server-side render placeholder — the hydration only swaps in the
    // viewer once we know the format from the HEAD probe.
    return (
      <section className="scene-card" aria-hidden>
        <div
          style={{
            width: "100%",
            height: "min(60vh, 460px)",
            background: "#0d0d0f",
            borderRadius: 16,
          }}
        />
      </section>
    );
  }

  if (error) {
    return (
      <section className="scene-card scene-card-error">
        <div>
          <strong>Scene unavailable.</strong>
          <p className="muted">{error}</p>
          <a href={url} target="_blank" rel="noreferrer">
            Try opening directly ↗
          </a>
        </div>
      </section>
    );
  }

  if (format === "usdz") {
    return <UsdzCard url={url} attestor={attestor} />;
  }

  return <GlbCard url={url} attestor={attestor} />;
}

function GlbCard({ url, attestor }: { url: string; attestor?: string }) {
  return (
    <section className="scene-card">
      {/* Self-hosted model-viewer (instead of the googleapis CDN) so
          it isn't blocked by Cross-Origin-Embedder-Policy on this
          isolated route. Same script, same version, just same-origin. */}
      <Script
        type="module"
        src="/model-viewer.min.js"
        strategy="lazyOnload"
      />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <model-viewer
        {...({
          src: url,
          alt: "Captured 3D scene",
          "camera-controls": "",
          "auto-rotate": "",
          ar: "",
          "ar-modes": "scene-viewer webxr quick-look",
          "ios-src": url,
          "shadow-intensity": "1",
          exposure: "0.9",
          loading: "eager",
          style: {
            width: "100%",
            height: "min(60vh, 460px)",
            background: "#0d0d0f",
            borderRadius: 16,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)}
      />
      <Caption attestor={attestor} />
    </section>
  );
}

/**
 * USDZ preview card. Apple's USDZ format renders flawlessly in
 * QuickLook (iOS/iPadOS/macOS Finder) — orbit, scale, tap-to-place
 * in AR. We surface that as the primary action; in-browser WebGL
 * rendering of USDZ requires Pixar's USD WASM with COOP/COEP +
 * pthreads + SharedArrayBuffer, which is fragile across browsers
 * and adds 9 MB to the bundle for a worse render than QuickLook.
 *
 * iPhone/iPad → "Open in QuickLook" → AR experience
 * Mac        → "Open in QuickLook" → Finder preview
 * Windows/Android → "Download .usdz" → handle in their native viewer
 */
function UsdzCard({ url, attestor }: { url: string; attestor?: string }) {
  const isApple =
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

  return (
    <section
      className="scene-card"
      style={{
        background:
          "radial-gradient(circle at 50% 35%, rgba(110,231,183,0.08), transparent 60%), var(--bg-card)",
        padding: 40,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 64,
          marginBottom: 16,
          filter: "drop-shadow(0 4px 24px rgba(110,231,183,0.3))",
        }}
        aria-hidden
      >
        📦
      </div>
      <h3 style={{ margin: "0 0 8px", fontSize: 20 }}>USDZ scene</h3>
      <p
        className="muted"
        style={{ margin: "0 auto 24px", maxWidth: 400, lineHeight: 1.55 }}
      >
        {isApple
          ? "Tap below to open the 3D capture in QuickLook — orbit, scale, and place in your room with AR."
          : "Apple's native 3D format. Open on iPhone, iPad, or Mac for AR + QuickLook preview, or download to view in Blender / Maya / your USDZ viewer of choice."}
      </p>
      <a
        href={url}
        rel="ar"
        download={!isApple ? "scene.usdz" : undefined}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "var(--accent)",
          color: "var(--accent-fg)",
          padding: "14px 28px",
          borderRadius: 999,
          textDecoration: "none",
          fontWeight: 600,
          fontSize: 15,
          boxShadow: "0 8px 30px rgba(110,231,183,0.25)",
        }}
      >
        {isApple ? "Open in QuickLook" : "Download .usdz"}
      </a>
      <Caption attestor={attestor} />
    </section>
  );
}

function Caption({ attestor }: { attestor?: string }) {
  if (!attestor) return null;
  return (
    <p className="muted scene-caption">
      Captured by{" "}
      <a
        href={`https://sepolia.basescan.org/address/${attestor}`}
        target="_blank"
        rel="noreferrer"
        className="mono"
      >
        {attestor.slice(0, 8)}…{attestor.slice(-6)}
      </a>
    </p>
  );
}
