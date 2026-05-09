"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";

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

type SceneFormat = "glb" | "usdz" | "unknown";

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
          // Default to GLB-attempt; model-viewer will at least try.
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
  return <GlbCard url={url} attestor={attestor} mode={mode} />;
}

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

  // Architectural-diagram render for room scans. Lighting alone can't
  // make a white-on-white room legible: PBR on uniform-color planar
  // surfaces gives identical brightness on both sides of a corner, so
  // the seam is literally not in the image. Three things together fix
  // it:
  //
  // 1. Per-face shading. We compute a face normal for every triangle
  //    in every mesh and write a per-vertex color based on that normal:
  //    floor (normal up) → warm beige, ceiling (normal down) → cool
  //    grey, walls → calm tones varying by horizontal facing. We then
  //    swap the mesh's material for a flat MeshBasicMaterial with
  //    vertexColors = true, so each face renders its own shade.
  //    No more white-on-white.
  //
  // 2. Bold edge overlay using Line2/LineMaterial — Three.js's
  //    screen-space-thick line primitive. Plain LineSegments uses
  //    WebGL gl.LINES which is capped at 1px on every desktop browser
  //    and was invisible at distance. Line2 renders lines as
  //    camera-facing quads, so we can ask for 3 px and actually get
  //    3 px. Edges are extracted at a 22° angle threshold — corners,
  //    doors, window frames pop; coplanar triangle seams stay quiet.
  //
  // 3. Polygon offset + double-sided + back to PBR for object captures.
  //    Object scans with photogrammetry textures don't get the
  //    architectural treatment — they keep their PBR materials and
  //    just get the safety surgeries (doubleSided, polygonOffset).
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
        for (const m of mats) {
          m.setDoubleSided?.(true);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tm: any =
            m[Symbol.for("material")] ??
            m.threeMaterial ??
            m._material;
          if (tm) {
            tm.polygonOffset = true;
            tm.polygonOffsetFactor = 1;
            tm.polygonOffsetUnits = 1;
            tm.needsUpdate = true;
          }
        }

        if (!isRoom) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const root: THREE.Object3D | null =
          mv[Symbol.for("scene")] ??
          mv[Symbol.for("threeScene")] ??
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (mv.model as any)?.[Symbol.for("model")] ??
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (mv.model as any)?.modelContainer ??
          null;
        if (!root || typeof root.traverse !== "function") {
          console.warn("[scene] couldn't find three.js root in model-viewer");
          return;
        }

        // Calm architectural palette. Each pair of perpendicular
        // surfaces ends up in a different bucket, so corners always
        // show a tonal step.
        const FLOOR: [number, number, number] = [0.86, 0.80, 0.70];
        const CEILING: [number, number, number] = [0.62, 0.66, 0.72];
        const WALLS: [number, number, number][] = [
          [0.94, 0.94, 0.96],
          [0.78, 0.82, 0.86],
          [0.88, 0.86, 0.82],
          [0.82, 0.85, 0.80],
        ];
        const colorForNormal = (
          nx: number,
          ny: number,
          nz: number,
        ): [number, number, number] => {
          if (ny > 0.7) return FLOOR;
          if (ny < -0.7) return CEILING;
          // Horizontal walls — bin by atan2(z, x) into 4 buckets so
          // adjacent walls (90° apart) always land in different bins.
          const angle = Math.atan2(nz, nx);
          const bin = ((Math.floor(((angle + Math.PI) / (2 * Math.PI)) * 4) %
            4) +
            4) %
            4;
          return WALLS[bin]!;
        };

        // We need the renderer canvas size for Line2 resolution.
        const canvas = mv.shadowRoot?.querySelector("canvas") as
          | HTMLCanvasElement
          | undefined;
        const resolution = new THREE.Vector2(
          canvas?.width ?? 1280,
          canvas?.height ?? 720,
        );

        const lineMat = new LineMaterial({
          color: 0x0a0d12, // near-black; reads as ink against any wall
          linewidth: 3, // pixels
          worldUnits: false,
          transparent: true,
          opacity: 1,
          depthTest: true,
          resolution,
        });

        root.traverse((child: THREE.Object3D) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh || !mesh.geometry) return;
          if (mesh.userData._archified) return;

          const geom = mesh.geometry as THREE.BufferGeometry;
          const pos = geom.getAttribute("position") as THREE.BufferAttribute;
          if (!pos) return;

          // Compute per-vertex colors from face normals. To get a flat
          // (one-color-per-face) look we'd need un-shared vertices;
          // RoomPlan walls don't share vertices across different walls
          // anyway, so writing the face color to each of the
          // triangle's three vertices works in practice.
          const colors = new Float32Array(pos.count * 3);
          const va = new THREE.Vector3();
          const vb = new THREE.Vector3();
          const vc = new THREE.Vector3();
          const ab = new THREE.Vector3();
          const ac = new THREE.Vector3();
          const normal = new THREE.Vector3();

          const writeFace = (a: number, b: number, c: number) => {
            va.fromBufferAttribute(pos, a);
            vb.fromBufferAttribute(pos, b);
            vc.fromBufferAttribute(pos, c);
            ab.subVectors(vb, va);
            ac.subVectors(vc, va);
            normal.crossVectors(ab, ac).normalize();
            const [r, g, bl] = colorForNormal(normal.x, normal.y, normal.z);
            for (const vi of [a, b, c]) {
              colors[vi * 3] = r;
              colors[vi * 3 + 1] = g;
              colors[vi * 3 + 2] = bl;
            }
          };

          const idx = geom.index;
          if (idx) {
            for (let i = 0; i < idx.count; i += 3) {
              writeFace(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
            }
          } else {
            for (let i = 0; i < pos.count; i += 3) {
              writeFace(i, i + 1, i + 2);
            }
          }

          geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));

          // Swap PBR for a flat unlit material so our per-face colors
          // aren't re-lit by IBL (which would just average them back
          // toward white). Side: DoubleSide because RoomPlan walls
          // face inward.
          mesh.material = new THREE.MeshBasicMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
          });

          // Bold edge overlay via Line2 (renders thick screen-space
          // lines, unlike LineBasicMaterial which is gl.LINES = 1px).
          const edgesGeom = new THREE.EdgesGeometry(geom, 22);
          const lineGeom = new LineSegmentsGeometry().fromEdgesGeometry(
            edgesGeom,
          );
          // LineSegments2 (not Line2) is the right pair for
          // LineSegmentsGeometry — Line2 expects LineGeometry, which is
          // a continuous polyline, not the disjoint segment pairs that
          // EdgesGeometry produces.
          const line = new LineSegments2(lineGeom, lineMat);
          line.computeLineDistances();
          line.userData._edgeOverlay = true;
          // renderOrder pushes the lines to draw after the surface so
          // they sit cleanly on top.
          line.renderOrder = 999;
          mesh.add(line);

          mesh.userData._archified = true;
        });

        // Keep Line2 looking right when the canvas resizes.
        const ro =
          typeof ResizeObserver !== "undefined"
            ? new ResizeObserver(() => {
                if (!canvas) return;
                lineMat.resolution.set(canvas.width, canvas.height);
              })
            : null;
        if (canvas && ro) ro.observe(canvas);
      } catch (e) {
        console.warn("[scene] post-load surgery failed", e);
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
          exposure: "1.0",
          "shadow-intensity": "1",
          "shadow-softness": isRoom ? "0.5" : "0.6",
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
