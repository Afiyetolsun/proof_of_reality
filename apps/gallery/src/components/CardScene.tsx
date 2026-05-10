"use client";

/**
 * Auto-spinning 3D preview overlay for gallery cards.
 *
 * Sits absolutely over the static <CardThumbnail> pictogram. On
 * viewport-enter we ask /api/preview whether the contenthash already
 * has a renderable GLB available (either it's already GLB on Swarm,
 * or the converter has it cached). If yes, we mount a hidden
 * <model-viewer> and reveal it ONLY after model-viewer's `load` event
 * fires successfully. If the GLB never resolves or model-viewer emits
 * an `error`, we leave the pictogram showing — the user explicitly
 * doesn't want broken/black canvases on cards.
 *
 * The whole element stays a Link target so clicking still navigates to
 * the per-name detail page. We don't enable controls or zoom — the
 * grid is for browsing, the detail page is for inspection.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";

interface Props {
  /** ENS contenthash, in the shape returned by lib/ens.ts. */
  content: { protocol: "bzz" | "ipfs"; ref: string };
  /**
   * Capture mode. Only `objectCapture` scans get a spinning preview —
   * apartment scans (roomPlan) keep their static pictogram because
   * the WebGL context cost per card adds up fast and white-walled
   * room renders read poorly at thumbnail size anyway.
   */
  mode: string | null;
  /** Detail-page URL — the whole card surface deep-links here. */
  detailHref: string;
}

type Stage =
  // Default while the card is offscreen. Pictogram visible.
  | { kind: "idle" }
  // /api/preview is in flight; pictogram still visible.
  | { kind: "resolving" }
  // Got a GLB ref; <model-viewer> mounted but transparent until its
  // `load` event fires.
  | { kind: "loading"; previewUrl: string }
  // <model-viewer> fired `load`. Reveal it over the pictogram.
  | { kind: "playing"; previewUrl: string }
  // No preview available — keep the pictogram, no model-viewer ever
  // mounted. Card still links to the detail page via the wrapping
  // <Link>.
  | { kind: "no-preview" };

export function CardScene({ content, mode, detailHref }: Props) {
  const containerRef = useRef<HTMLAnchorElement | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const isObject = mode === "objectCapture" || mode === "object";

  // Probe + mount on viewport-enter. We only run /api/preview after
  // the IntersectionObserver fires so the gallery doesn't fan out N
  // converter calls on first paint. Apartments (roomPlan) skip the
  // preview entirely — the pictogram stays.
  useEffect(() => {
    if (!isObject) return;
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    const io = new IntersectionObserver(
      async (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.disconnect();
          if (cancelled) return;
          setStage({ kind: "resolving" });
          try {
            const res = await fetch(
              `/api/preview?proto=${content.protocol}&ref=${encodeURIComponent(content.ref)}`,
              { cache: "force-cache" },
            );
            if (cancelled) return;
            if (!res.ok) {
              setStage({ kind: "no-preview" });
              return;
            }
            const json = (await res.json()) as { glbRef?: string | null };
            if (cancelled) return;
            if (!json.glbRef) {
              setStage({ kind: "no-preview" });
              return;
            }
            setStage({
              kind: "loading",
              previewUrl: `/api/scene?proto=bzz&ref=${json.glbRef}`,
            });
          } catch {
            if (!cancelled) setStage({ kind: "no-preview" });
          }
          return;
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [content.protocol, content.ref, isObject]);

  return (
    <Link
      ref={containerRef}
      href={detailHref}
      prefetch
      aria-label="Open 3D preview on detail page"
      className="absolute inset-0 z-10"
    >
      {(stage.kind === "loading" || stage.kind === "playing") && (
        <ModelPreview
          src={stage.previewUrl}
          visible={stage.kind === "playing"}
          onLoad={() =>
            setStage((cur) =>
              cur.kind === "loading"
                ? { kind: "playing", previewUrl: cur.previewUrl }
                : cur,
            )
          }
          onError={() => setStage({ kind: "no-preview" })}
        />
      )}
    </Link>
  );
}

function ModelPreview({
  src,
  visible,
  onLoad,
  onError,
}: {
  src: string;
  visible: boolean;
  onLoad: () => void;
  onError: () => void;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleLoad = () => onLoad();
    const handleError = () => onError();
    el.addEventListener("load", handleLoad);
    el.addEventListener("error", handleError);
    return () => {
      el.removeEventListener("load", handleLoad);
      el.removeEventListener("error", handleError);
    };
  }, [onLoad, onError]);

  return (
    <>
      <Script type="module" src="/model-viewer.min.js" strategy="lazyOnload" />
      {/* Solid backing layer behind the canvas. This is what replaces
          the pictogram's dot-grid/warm-radial when the preview
          actually plays — a calm radial spotlight that doesn't fight
          the rendered model. Fades in with the canvas via the same
          opacity transition. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 35%, oklch(0.22 0.025 250) 0%, oklch(0.13 0.012 250) 70%)",
          opacity: visible ? 1 : 0,
          transition: "opacity 220ms ease-out",
          pointerEvents: "none",
        }}
      />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <model-viewer
        {...({
          ref,
          src,
          alt: "Captured 3D scene preview",
          // Pure preview: rotate, no controls, no AR, no interaction
          // prompt. The detail page is where the full viewer lives.
          "auto-rotate": "",
          "interaction-prompt": "none",
          "disable-zoom": "",
          "disable-pan": "",
          "disable-tap": "",
          "environment-image": "neutral",
          "tone-mapping": "aces",
          "shadow-intensity": "0.7",
          "shadow-softness": "0.6",
          exposure: "1.0",
          loading: "eager",
          style: {
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            background: "transparent",
            opacity: visible ? 1 : 0,
            transition: "opacity 220ms ease-out",
            pointerEvents: "none",
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)}
      />
    </>
  );
}
