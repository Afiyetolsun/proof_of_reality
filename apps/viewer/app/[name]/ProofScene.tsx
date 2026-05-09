"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { UsdzCanvas } from "./UsdzCanvas";

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
      {/* Lazy-load model-viewer ONLY when we actually have a GLB to
          render. USDZ pages don't load it (it can't render USDZ in
          canvas anyway), saving ~400 KB of JS + sidestepping a stack
          of model-viewer warnings/errors when no model is mounted. */}
      <Script
        type="module"
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js"
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
 * USDZ preview. Renders the Apple-native format directly in browser
 * via three.js's USDZLoader (wrapped by three-usdz-loader). Beats
 * the black-canvas / QuickLook-only fallback we had before — judges
 * see the model spinning in their browser without leaving the tab.
 *
 * Keeps the AR button as a secondary action since it triggers Apple
 * QuickLook on iPhone/iPad with the full-fidelity native renderer.
 */
function UsdzCard({ url, attestor }: { url: string; attestor?: string }) {
  const isApple =
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

  return (
    <section className="scene-card">
      <UsdzCanvas url={url} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 12,
          gap: 12,
        }}
      >
        <Caption attestor={attestor} />
        {isApple && (
          <a
            href={url}
            rel="ar"
            style={{
              display: "inline-block",
              background: "var(--accent)",
              color: "var(--accent-fg)",
              padding: "8px 16px",
              borderRadius: 999,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            View in AR
          </a>
        )}
      </div>
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
