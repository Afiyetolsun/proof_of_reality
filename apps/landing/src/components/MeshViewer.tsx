"use client";

import { type CSSProperties } from "react";

// model-viewer is a Web Component registered globally by the <Script> tag in
// app/layout.tsx. We declare it here so TS accepts it inside JSX.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerProps;
    }
  }
}

type ModelViewerProps = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  src?: string;
  alt?: string;
  "auto-rotate"?: boolean | "";
  "auto-rotate-delay"?: number | string;
  "rotation-per-second"?: string;
  "camera-controls"?: boolean | "";
  "interaction-prompt"?: "auto" | "when-focused" | "none";
  "shadow-intensity"?: number | string;
  "environment-image"?: string;
  exposure?: number | string;
  "tone-mapping"?: "neutral" | "aces" | "agx" | "commerce" | "filmic";
  "disable-zoom"?: boolean | "";
  "field-of-view"?: string;
  "min-camera-orbit"?: string;
  "max-camera-orbit"?: string;
  "camera-orbit"?: string;
  poster?: string;
  loading?: "auto" | "lazy" | "eager";
  reveal?: "auto" | "interaction" | "manual";
};

export function MeshViewer({
  src,
  className = "",
  ariaLabel,
  active = true,
}: {
  src: string;
  className?: string;
  ariaLabel?: string;
  /** When false, auto-rotation is paused. */
  active?: boolean;
}) {
  const style: CSSProperties = {
    width: "100%",
    height: "100%",
    backgroundColor: "transparent",
    // Ensure the canvas inside model-viewer fills the host
    "--poster-color": "transparent",
  } as CSSProperties;

  return (
    <div className={`relative ${className}`}>
      {/* @ts-expect-error – custom element JSX typing */}
      <model-viewer
        src={src}
        alt={ariaLabel}
        camera-controls=""
        {...(active ? { "auto-rotate": "" } : {})}
        rotation-per-second="22deg"
        auto-rotate-delay="0"
        interaction-prompt="none"
        environment-image="neutral"
        tone-mapping="neutral"
        exposure="1.05"
        shadow-intensity="0"
        loading="eager"
        reveal="auto"
        style={style}
      />
    </div>
  );
}
