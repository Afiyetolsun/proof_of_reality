"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  /** Render this placeholder until the splat is on screen. */
  placeholder?: React.ReactNode;
};

type Stage = "loading" | "ready" | "failed";

type SplatLib = {
  Viewer?: SplatViewerCtor;
  default?: { Viewer?: SplatViewerCtor };
};
type SplatViewerCtor = new (opts: Record<string, unknown>) => SplatViewer;
type SplatControls = {
  autoRotate: boolean;
  autoRotateSpeed: number;
  enableZoom: boolean;
  enablePan: boolean;
  enableDamping: boolean;
  dampingFactor: number;
  minDistance: number;
  maxDistance: number;
  target?: { set: (x: number, y: number, z: number) => void };
};
type SplatViewer = {
  controls?: SplatControls;
  camera?: { position: { set: (x: number, y: number, z: number) => void } };
  addSplatScene: (url: string, opts?: Record<string, unknown>) => Promise<void>;
  start: () => void;
  dispose?: () => Promise<void> | void;
};

export function PlyHero({ src, placeholder }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [stage, setStage] = useState<Stage>("loading");

  useEffect(() => {
    let disposed = false;
    const mount = mountRef.current;
    if (!mount) return;

    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const lib = (await import("@mkkellogg/gaussian-splats-3d")) as unknown as SplatLib;
        if (disposed) return;

        const ViewerCtor = lib.Viewer ?? lib.default?.Viewer;
        if (!ViewerCtor) throw new Error("Viewer not exported by gaussian-splats-3d");

        const viewer = new ViewerCtor({
          rootElement: mount,
          sharedMemoryForWorkers: false,
          useBuiltInControls: true,
          selfDrivenMode: true,
          cameraUp: [0, 1, 0],
          initialCameraPosition: [-2.4, 1.6, 9],
          initialCameraLookAt: [0, 0, 0],
        });

        await viewer.addSplatScene(src, {
          showLoadingUI: true,
          progressiveLoad: false,
          splatAlphaRemovalThreshold: 5,
        });

        if (disposed) {
          try {
            await viewer.dispose?.();
          } catch {
            // ignore
          }
          return;
        }

        viewer.start();

        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (viewer.controls) {
          viewer.controls.autoRotate = !reduceMotion;
          viewer.controls.autoRotateSpeed = 0.6;
          viewer.controls.enableDamping = true;
          viewer.controls.dampingFactor = 0.08;
          viewer.controls.enablePan = false;
        }

        // Make the viewer canvas inherit our transparent surface.
        mount.querySelectorAll("canvas").forEach((c) => {
          (c as HTMLCanvasElement).style.background = "transparent";
        });

        setStage("ready");

        cleanup = async () => {
          try {
            await viewer.dispose?.();
          } catch {
            // ignore
          }
          while (mount.firstChild) mount.removeChild(mount.firstChild);
        };
      } catch (err) {
        console.error("PlyHero load failed", err);
        if (!disposed) setStage("failed");
      }
    })();

    return () => {
      disposed = true;
      if (cleanup) {
        Promise.resolve(cleanup()).catch(() => {});
      }
    };
  }, [src]);

  return (
    <div className="relative aspect-square w-full select-none overflow-hidden">
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{ opacity: stage === "ready" ? 0 : 1 }}
        aria-hidden={stage === "ready"}
      >
        {placeholder}
      </div>

      {stage !== "failed" && (
        <div
          ref={mountRef}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: stage === "ready" ? 1 : 0 }}
          aria-label="Captured Gaussian splat scene, slowly orbiting"
          role="img"
        />
      )}

      {stage === "ready" && (
        <>
          <div className="pointer-events-none absolute right-3 top-3 max-w-[60%] text-right">
            <div className="text-mono-s text-[--color-ink-mute]">CAPTURED · GAUSSIAN SPLAT</div>
            <div className="text-mono-s text-[--color-signal]">330k splats</div>
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
