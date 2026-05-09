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
 * 3D scene preview for the per-name page. HEAD-probes the proxy to
 * decide between a <model-viewer> render (GLB / glTF) and the in-canvas
 * three.js USDZ pipeline (UsdzCanvas — Pixar USD WASM under the hood).
 *
 * Mounted client-side only so <model-viewer>'s ar-status mutation
 * doesn't trigger a hydration mismatch.
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
        } else if (
          ct.includes("gltf") ||
          ct.includes("glb") ||
          ext === "glb" ||
          ext === "gltf"
        ) {
          setFormat("glb");
        } else {
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

  // Treat the pre-format-detection state the same as the SSR placeholder.
  // Otherwise we'd fall through to GlbCard while the HEAD probe is still
  // in flight, eagerly mount <model-viewer> (which bundles its own
  // three.js), and only later swap to UsdzCard — bloating the page,
  // emitting a "Multiple instances of Three.js" warning, and racing the
  // USD WASM init.
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
  return <GlbCard url={url} attestor={attestor} />;
}

function GlbCard({ url, attestor }: { url: string; attestor?: string }) {
  return (
    <div className="border border-[--color-rule] bg-[--color-surface-raised] p-2">
      <Script type="module" src="/model-viewer.min.js" strategy="lazyOnload" />
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
 * USDZ scene card. Renders the model in-browser via three-usdz-loader
 * (Pixar USD compiled to WASM). On Apple devices we additionally
 * surface a QuickLook AR button as a secondary action.
 */
function UsdzCard({ url, attestor }: { url: string; attestor?: string }) {
  const isApple =
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

  return (
    <div className="border border-[--color-rule] bg-[--color-surface-raised] p-2">
      <UsdzCanvas url={url} />
      <div className="flex items-center justify-between gap-3 px-2 pt-3">
        <Caption attestor={attestor} />
        {isApple && (
          <a
            href={url}
            rel="ar"
            className="inline-block whitespace-nowrap rounded-full bg-[--color-signal] px-4 py-2 text-mono-xs font-semibold text-[--color-surface-deep]"
          >
            View in AR
          </a>
        )}
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
