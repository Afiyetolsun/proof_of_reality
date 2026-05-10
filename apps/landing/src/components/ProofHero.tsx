"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { HeroOrbital } from "./HeroOrbital";
import { viewerHome } from "../lib/viewer-link";

// <model-viewer> is registered globally by the <Script> in app/layout.tsx
// and typed in MeshViewer.tsx (same project, same global JSX namespace),
// so we don't redeclare it here.

type Stage = "loading" | "ready" | "failed";

type ResolveResponse = {
  name?: string;
  url?: string;
  ref?: string;
  mode?: string | null;
  tokenId?: string | null;
};

/**
 * Hero 3D viewer that renders a real, minted Reality NFT live.
 *
 * Resolves an ENS subname via the gallery's /api/resolve endpoint (which
 * runs the same ENS-on-Sepolia + USDZ→GLB converter pipeline the per-name
 * page uses) and feeds the resulting GLB URL to <model-viewer>. Until the
 * model fires its load event we render <HeroOrbital> as a placeholder,
 * mirroring the same loading affordance the Gaussian-splat hero used.
 */
export function ProofHero({
  name,
  resolveBase,
}: {
  /** Full ENS subname (e.g. "pizza.realityproof.eth") or short form ("pizza"). */
  name: string;
  /** Origin that hosts /api/resolve. Defaults to the verifier deployment. */
  resolveBase?: string;
}) {
  const base = (resolveBase ?? viewerHome).replace(/\/$/, "");
  const [stage, setStage] = useState<Stage>("loading");
  const [src, setSrc] = useState<string | null>(null);
  const [meta, setMeta] = useState<ResolveResponse | null>(null);
  const viewerRef = useRef<HTMLElement | null>(null);

  // Resolve the ENS name to a renderable scene URL.
  useEffect(() => {
    let abort = false;
    const url = `${base}/api/resolve?name=${encodeURIComponent(name)}`;
    fetch(url, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`resolve ${r.status}`);
        return (await r.json()) as ResolveResponse;
      })
      .then((j) => {
        if (abort || !j.url) return;
        setMeta(j);
        setSrc(j.url);
      })
      .catch((e) => {
        if (abort) return;
        console.warn("[ProofHero] resolve failed:", (e as Error).message);
        setStage("failed");
      });
    return () => {
      abort = true;
    };
  }, [name, base]);

  // Listen for the model-viewer load event so we cross-fade the
  // placeholder out only once the GLB is actually drawn. model-viewer
  // emits "load" exactly once per src.
  useEffect(() => {
    const el = viewerRef.current;
    if (!el || !src) return;
    const onLoad = () => setStage("ready");
    const onError = () => setStage("failed");
    el.addEventListener("load", onLoad);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("load", onLoad);
      el.removeEventListener("error", onError);
    };
  }, [src]);

  const viewerStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    backgroundColor: "transparent",
    // Ensure the canvas inside model-viewer fills the host
    ["--poster-color" as string]: "transparent",
  };

  return (
    <div className="relative aspect-square w-full select-none overflow-hidden">
      {/* Placeholder underneath; fades out when the real scene reports load */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{ opacity: stage === "ready" ? 0 : 1 }}
        aria-hidden={stage === "ready"}
      >
        <HeroOrbital />
      </div>

      {src && stage !== "failed" && (
        <div
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: stage === "ready" ? 1 : 0 }}
          aria-label={`Reality NFT scene for ${meta?.name ?? name}, slowly orbiting`}
          role="img"
        >
          {/* @ts-expect-error – custom element JSX typing */}
          <model-viewer
            ref={viewerRef}
            src={src}
            alt={`Reality NFT scene for ${meta?.name ?? name}`}
            camera-controls=""
            auto-rotate=""
            rotation-per-second="22deg"
            auto-rotate-delay="0"
            interaction-prompt="none"
            environment-image="neutral"
            tone-mapping="neutral"
            exposure="1.05"
            shadow-intensity="0"
            loading="eager"
            reveal="auto"
            style={viewerStyle}
          />
        </div>
      )}

      {stage === "ready" && meta && (
        <>
          <div className="pointer-events-none absolute right-3 top-3 max-w-[60%] text-right">
            <div className="text-mono-s text-[--color-ink-mute]">
              CAPTURED · {(meta.mode ?? "OBJECT").toUpperCase()}
            </div>
            <div className="text-mono-s text-[--color-signal]">
              {meta.name?.split(".")[0] ?? name.split(".")[0]}
              {meta.tokenId ? ` · #${meta.tokenId}` : ""}
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 max-w-[80%]">
            <div className="text-mono-s text-[--color-ink-mute]">BOUND COSMIC NONCE</div>
            <NonceLabel />
          </div>
        </>
      )}
    </div>
  );
}

function NonceLabel() {
  const [n, setN] = useState("0a4c2ea2 … 9d2526");
  useEffect(() => {
    let abort = false;
    const fetchOnce = () => {
      fetch("/api/nonce", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { nonce?: string } | null) => {
          if (abort || !j?.nonce) return;
          setN(`${j.nonce.slice(0, 8)} … ${j.nonce.slice(-6)}`);
        })
        .catch(() => {});
    };
    fetchOnce();
    const id = window.setInterval(fetchOnce, 12_000);
    return () => {
      abort = true;
      window.clearInterval(id);
    };
  }, []);
  return <div className="text-mono text-[--color-signal]">{n}</div>;
}
