"use client";

import { useState } from "react";
import { Mono } from "./Mono";
import { MeshViewer } from "./MeshViewer";

type Mode = "real" | "fake";

const REAL_GLB = "/mesh/penguin-real.glb";
const FAKE_GLB = "/mesh/penguin-fake.glb";

export function RealVsFake() {
  const [mode, setMode] = useState<Mode>("real");
  // Lazy-mount the fake viewer only after first toggle, since the asset is ~40 MB.
  const [fakeMounted, setFakeMounted] = useState(false);
  const real = mode === "real";

  const goFake = () => {
    setFakeMounted(true);
    setMode("fake");
  };

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-10">
      <div className="md:col-span-7">
        <div className="relative aspect-[5/4] w-full overflow-hidden border border-[--color-rule] bg-[--color-surface-raised]">
          <div
            className="absolute inset-0 transition-opacity duration-500"
            style={{ opacity: real ? 1 : 0 }}
            aria-hidden={!real}
          >
            <MeshViewer
              src={REAL_GLB}
              active={real}
              ariaLabel="Real penguin: a captured 3D scan"
              className="h-full w-full"
            />
          </div>
          <div
            className="absolute inset-0 transition-opacity duration-500"
            style={{ opacity: real ? 0 : 1 }}
            aria-hidden={real}
          >
            {fakeMounted ? (
              <MeshViewer
                src={FAKE_GLB}
                active={!real}
                ariaLabel="AI-generated penguin: a synthetic 3D model"
                className="h-full w-full"
              />
            ) : null}
          </div>

          <Corners color={real ? "signal" : "warn"} />

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <div className="text-mono-s text-[--color-ink-mute]">
              {real ? "REAL · scan-penguin-001.glb" : "FAKE · gen-stable3d-77.glb"}
            </div>
            <div className="flex border border-[--color-rule]">
              <button
                onClick={() => setMode("real")}
                className={`px-3 py-1 text-mono-s transition-colors ${
                  real
                    ? "bg-[--color-signal] text-[--color-surface-deep]"
                    : "text-[--color-ink-mute] hover:text-[--color-ink]"
                }`}
              >
                REAL
              </button>
              <button
                onClick={goFake}
                className={`px-3 py-1 text-mono-s transition-colors ${
                  !real
                    ? "bg-[--color-warn] text-[--color-surface-deep]"
                    : "text-[--color-ink-mute] hover:text-[--color-ink]"
                }`}
              >
                AI-GENERATED
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="md:col-span-5">
        <h3 className="text-h2 text-[--color-ink]">
          {real ? "Five witnesses agree." : "Three witnesses dissent."}
        </h3>
        <ul className="mt-6 space-y-3 text-body-s">
          <CheckRow ok={real} label="Cosmic nonce signature" detail={real ? "verified · aptosorbital" : "absent"} />
          <CheckRow ok={real} label="KMS co-signature" detail={real ? "verified · space-fabric" : "absent"} />
          <CheckRow ok={real} label="Device key signature" detail={real ? "verified · 0xA3…f9" : "unrecognized issuer"} />
          <CheckRow ok={true} label="Swarm CAC" detail="content addressed" />
          <CheckRow ok={real} label="App Attest" detail={real ? "verified · iOS" : "missing"} />
        </ul>
        <div className="mt-6 border-t border-[--color-rule] pt-4">
          <div className="text-mono-s text-[--color-ink-mute]">VERDICT</div>
          <div
            className={`mt-1 text-h2 ${real ? "text-[--color-signal]" : "text-[--color-warn]"}`}
          >
            {real ? "ACCEPTED" : "REJECTED"}
          </div>
          <div className="mt-2 text-body-s text-[--color-ink-mute]">
            {real
              ? "Bundle hash recomputes. All five signatures match published trust roots."
              : "No satellite signature, no KMS co-signature, device key not in registry. The verifier refuses to mint."}
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-baseline justify-between gap-4 border-b border-[--color-rule] pb-3">
      <span className="flex items-center gap-3">
        <span
          aria-hidden
          className={`inline-block h-2 w-2 rounded-full ${
            ok ? "bg-[--color-signal]" : "bg-[--color-warn]"
          }`}
        />
        <span className="text-[--color-ink]">{label}</span>
      </span>
      <Mono className="text-[--color-ink-mute]">{detail}</Mono>
    </li>
  );
}

function Corners({ color }: { color: "signal" | "warn" }) {
  const stroke = color === "signal" ? "oklch(0.74 0.14 58)" : "oklch(0.62 0.16 28)";
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 80"
      preserveAspectRatio="none"
    >
      {([
        [2, 2, 1, 1],
        [98, 2, -1, 1],
        [2, 78, 1, -1],
        [98, 78, -1, -1],
      ] as const).map(([x, y, dx, dy], i) => (
        <g key={i} stroke={stroke} strokeWidth="0.4" fill="none">
          <line x1={x} y1={y} x2={x + dx * 6} y2={y} />
          <line x1={x} y1={y} x2={x} y2={y + dy * 6} />
        </g>
      ))}
    </svg>
  );
}
