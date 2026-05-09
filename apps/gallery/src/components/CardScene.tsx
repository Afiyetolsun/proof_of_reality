"use client";

/**
 * Inline 3D preview for gallery cards. Default state is the static
 * gradient thumbnail behind us (zero WebGL contexts, fast page load);
 * clicking the play affordance mounts <model-viewer> with auto-rotate.
 *
 * Why click-to-play and not auto-mount on viewport-enter?
 *   Each active scene = one WebGL context. Browsers cap at ~16
 *   concurrent contexts; auto-mounting a 4-card grid plus scrolling
 *   exhausts that fast and the older cards go black. Click-to-play
 *   gives users one explicit context per intent.
 *
 * USDZ scenes don't get an in-grid preview: the per-name detail page
 * runs the server-side USDZ→GLB converter, but here in the grid we
 * only have the raw Swarm ref. Rather than spin up Pixar's USD WASM
 * (9 MB, fragile under wallet-extension SES lockdowns, and the source
 * of the "couldn't render USDZ" failures we used to see), the play
 * button on a USDZ card just deep-links to the detail page where
 * conversion is cached and rendering is solved.
 */
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";

type Format = "glb" | "usdz" | "unknown";

interface Props {
  url: string;
  /** Detail-page URL — used as the click target when the format is USDZ. */
  detailHref: string;
  /** Used for prefetching the HEAD probe on viewport-enter so the play
   *  button can render the right viewer (or link) instantly. */
  prefetch?: boolean;
}

export function CardScene({ url, detailHref, prefetch = true }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [format, setFormat] = useState<Format>("unknown");

  useEffect(() => {
    if (!prefetch) return;
    const el = containerRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            io.disconnect();
            void probeFormat(url).then(setFormat);
            return;
          }
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [url, prefetch]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      {!playing && format !== "usdz" && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Probe lazily if IO didn't get to it yet — clicking play
            // implies user wants 3D, so don't gate on viewport entry.
            if (format === "unknown") void probeFormat(url).then(setFormat);
            setPlaying(true);
          }}
          aria-label="Play 3D preview"
          className="group/play absolute inset-0 z-10 flex items-center justify-center bg-transparent transition-colors hover:bg-[oklch(0.16_0.012_250_/_0.25)]"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[--color-signal-soft] bg-[--color-surface-deep]/85 text-[--color-signal] backdrop-blur transition-transform group-hover/play:scale-110">
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="currentColor"
              aria-hidden
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="absolute bottom-3 left-3 rounded-full border border-[--color-rule] bg-[--color-surface-deep]/85 px-2 py-1 text-mono-xs uppercase tracking-[0.14em] text-[--color-ink-mute] backdrop-blur">
            {format === "glb" ? "glb" : "3d"}
          </span>
        </button>
      )}

      {!playing && format === "usdz" && (
        <Link
          href={detailHref}
          prefetch
          aria-label="Open 3D preview on detail page"
          className="group/play absolute inset-0 z-10 flex items-center justify-center bg-transparent transition-colors hover:bg-[oklch(0.16_0.012_250_/_0.25)]"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[--color-signal-soft] bg-[--color-surface-deep]/85 text-[--color-signal] backdrop-blur transition-transform group-hover/play:scale-110">
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="currentColor"
              aria-hidden
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="absolute bottom-3 left-3 rounded-full border border-[--color-rule] bg-[--color-surface-deep]/85 px-2 py-1 text-mono-xs uppercase tracking-[0.14em] text-[--color-ink-mute] backdrop-blur">
            usdz
          </span>
        </Link>
      )}

      {playing && (
        <>
          <Script type="module" src="/model-viewer.min.js" strategy="lazyOnload" />
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <model-viewer
            {...({
              src: url,
              alt: "Captured 3D scene",
              "auto-rotate": "",
              "interaction-prompt": "none",
              "environment-image": "neutral",
              "tone-mapping": "aces",
              "shadow-intensity": "0.8",
              "shadow-softness": "0.6",
              exposure: "0.95",
              loading: "eager",
              "disable-zoom": "",
              style: {
                width: "100%",
                height: "100%",
                background: "transparent",
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)}
          />
          <StopButton onClick={() => setPlaying(false)} />
        </>
      )}
    </div>
  );
}

function StopButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      aria-label="Stop preview"
      className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-[--color-rule] bg-[--color-surface-deep]/85 text-[--color-ink-mute] backdrop-blur transition-colors hover:text-[--color-ink]"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
        <rect x="6" y="6" width="12" height="12" fill="currentColor" />
      </svg>
    </button>
  );
}

async function probeFormat(url: string): Promise<Format> {
  try {
    const r = await fetch(url, { method: "HEAD" });
    if (!r.ok) return "unknown";
    const ct = (r.headers.get("content-type") ?? "").toLowerCase();
    const cd = r.headers.get("content-disposition") ?? "";
    const filename = /filename="?([^";]+)"?/.exec(cd)?.[1] ?? "";
    const ext = filename.toLowerCase().split(".").pop() ?? "";
    if (ct.includes("usdz") || ct.includes("usd") || ext === "usdz") return "usdz";
    if (ct.includes("gltf") || ct.includes("glb") || ext === "glb" || ext === "gltf") {
      return "glb";
    }
    // Default to USDZ in the ambiguous case — current iOS pipeline still
    // produces USDZ, and treating-as-USDZ degrades to a click-through link
    // which is safer than mounting model-viewer on a non-GLB.
    return "usdz";
  } catch {
    return "unknown";
  }
}
