"use client";

import { useEffect, useState } from "react";

interface Props {
  url: string;
  attestor?: string;
}

/**
 * 3D scene preview using <model-viewer> (Google's web component).
 *
 * Handles two formats with the same component:
 *   - GLB / glTF: native model-viewer support
 *   - USDZ: Apple AR Quick Look on iOS, model-viewer fallback elsewhere
 *
 * If the file is neither (or fetch fails), shows a "scene unavailable"
 * placeholder with a "View raw file" link.
 */
export function ProofScene({ url, attestor }: Props) {
  const [error, setError] = useState<string | null>(null);

  // Test the URL responds before mounting model-viewer; otherwise we get
  // a confusing silent black canvas.
  useEffect(() => {
    let cancelled = false;
    fetch(url, { method: "HEAD" })
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) setError(`scene fetch returned ${r.status}`);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

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

  return (
    <section className="scene-card">
      {/* model-viewer is registered globally by next/script in the parent page */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <model-viewer
        // model-viewer custom attrs aren't in React's intrinsics; cast as any
        {...({
          src: url,
          alt: "Captured 3D scene",
          "camera-controls": "",
          "auto-rotate": "",
          ar: "",
          "ar-modes": "scene-viewer webxr quick-look",
          "ios-src": url, // for USDZ files Safari falls back to QuickLook
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
      {attestor && (
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
      )}
    </section>
  );
}

