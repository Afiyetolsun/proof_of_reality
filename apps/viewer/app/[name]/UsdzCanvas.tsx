"use client";

/**
 * In-canvas USDZ viewer using three.js's USDZLoader (via three-usdz-loader).
 *
 * Renders Apple's USDZ format directly in the browser — no QuickLook
 * required. Auto-frames the loaded model, attaches OrbitControls
 * (drag to rotate, scroll to zoom, two-finger drag to pan), and runs
 * a render loop while the component is mounted.
 *
 * Cleans up everything on unmount: render loop, controls, scene
 * objects, and the WebGL context. Prevents leaked GL contexts when
 * navigating between proofs without reloading.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { USDZLoader } from "three-usdz-loader";

interface Props {
  url: string;
}

export function UsdzCanvas({ url }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [stage, setStage] = useState<string>("starting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let raf = 0;

    // ---- 1. Scene + camera + renderer ----
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0d0f);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.01,
      5000,
    );
    camera.position.set(0, 0.5, 2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    // ---- 2. Lights — USDZ from Object Capture ships without explicit
    //         lights, so a hemisphere + key light keeps it readable. ----
    const hemi = new THREE.HemisphereLight(0xffffff, 0x222233, 1.0);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(2, 4, 3);
    scene.add(key);

    // ---- 3. Controls ----
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.05;
    controls.maxDistance = 50;

    // ---- 4. Load the USDZ ----
    // Pixar's USD compiled to WASM (via three-usdz-loader). Handles
    // the full USD spec — works on every USDZ I've thrown at it,
    // including ones three.js's pure-JS USDZLoader chokes on.
    //
    // WASM bundle is in /public/usd/, served same-origin under our
    // COOP+COEP isolated /<name> route so SharedArrayBuffer works.
    // The loader auto-finds the WASM relative to the page origin.
    const loader = new USDZLoader("/usd");
    const groupHolder = new THREE.Group();
    scene.add(groupHolder);

    (async () => {
      try {
        const isolated = (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated;
        const sab = typeof SharedArrayBuffer !== "undefined";
        setStage(`isolated=${isolated} SAB=${sab}`);
        console.log("[usdz] crossOriginIsolated =", isolated, "SAB =", sab);
        if (!isolated || !sab) {
          throw new Error(
            "cross-origin isolation didn't engage. Hard-refresh (Cmd+Shift+R) the page or open in a private window. If still not isolated, the COOP/COEP middleware isn't running.",
          );
        }

        setStage("fetching scene from /api/scene…");
        const res = await fetch(url);
        if (!res.ok) throw new Error(`/api/scene returned ${res.status}`);
        const blob = await res.blob();
        setStage(`fetched ${(blob.size / 1024).toFixed(0)} KB; loading Pixar USD WASM…`);
        if (disposed) return;
        const file = new File([blob], "scene.usdz", { type: "model/vnd.usdz+zip" });
        await loader.loadFile(file, groupHolder);
        setStage("parsed; building three.js scene…");
        if (disposed) return;
        frameCamera(groupHolder, camera, controls);
        setStatus("ready");
      } catch (e) {
        console.error("[usdz] load failed:", e);
        if (disposed) return;
        setErrorMsg((e as Error).message);
        setStatus("error");
      }
    })();

    // ---- 5. Render loop ----
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    // ---- 6. Resize handling ----
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    // ---- 7. Teardown ----
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.traverse((obj) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const o = obj as any;
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) m.dispose?.();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [url]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "min(60vh, 460px)",
        background: "#0d0d0f",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      {status === "loading" && (
        <div style={overlayStyle}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
              Loading 3D scene…
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: 6,
                fontFamily: "ui-monospace, Menlo, monospace",
              }}
            >
              {stage}
            </div>
          </div>
        </div>
      )}
      {status === "error" && (
        <div style={overlayStyle}>
          <div style={{ textAlign: "center", padding: 24 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontSize: 14 }}>Couldn&apos;t render USDZ</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              {errorMsg}
            </div>
            <a
              href={url}
              rel="ar"
              download
              style={{
                display: "inline-block",
                marginTop: 16,
                background: "var(--accent)",
                color: "var(--accent-fg)",
                padding: "8px 16px",
                borderRadius: 999,
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Open in QuickLook instead
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
};

/** Frame the camera so the loaded model fills ~70% of the viewport. */
function frameCamera(
  group: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
) {
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = (camera.fov * Math.PI) / 180;
  const distance = (maxDim / (2 * Math.tan(fov / 2))) * 1.4;

  camera.position.copy(center);
  camera.position.x += distance * 0.4;
  camera.position.y += distance * 0.3;
  camera.position.z += distance;
  camera.near = Math.max(0.001, distance / 1000);
  camera.far = distance * 100;
  camera.updateProjectionMatrix();
  camera.lookAt(center);

  controls.target.copy(center);
  controls.update();
}
