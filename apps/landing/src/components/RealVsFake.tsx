"use client";

import { useState } from "react";
import { Mono } from "./Mono";

type Mode = "real" | "fake";

export function RealVsFake() {
  const [mode, setMode] = useState<Mode>("real");
  const real = mode === "real";

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-10">
      <div className="md:col-span-7">
        <div className="relative aspect-[5/4] w-full overflow-hidden border border-[--color-rule] bg-[--color-surface-raised]">
          {/* Two layers, one real and one fake, cross-faded */}
          <RealLayer visible={real} />
          <FakeLayer visible={!real} />

          {/* corner brackets */}
          <Corners color={real ? "signal" : "warn"} />

          {/* mode toggle */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <div className="text-mono-s text-[--color-ink-mute]">
              {real ? "REAL · capture-001.ply" : "FAKE · gen-stable3d-77.ply"}
            </div>
            <div className="flex border border-[--color-rule]">
              <button
                onClick={() => setMode("real")}
                className={`px-3 py-1 text-mono-s transition-colors ${
                  real ? "bg-[--color-signal] text-[--color-surface-deep]" : "text-[--color-ink-mute] hover:text-[--color-ink]"
                }`}
              >
                REAL
              </button>
              <button
                onClick={() => setMode("fake")}
                className={`px-3 py-1 text-mono-s transition-colors ${
                  !real ? "bg-[--color-warn] text-[--color-surface-deep]" : "text-[--color-ink-mute] hover:text-[--color-ink]"
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

function RealLayer({ visible }: { visible: boolean }) {
  return (
    <svg
      viewBox="0 0 500 400"
      className="absolute inset-0 h-full w-full transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
      aria-hidden
    >
      {/* gridded ground */}
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="oklch(0.30 0.014 250)" strokeWidth="0.3" />
        </pattern>
      </defs>
      <rect width="500" height="400" fill="url(#grid)" opacity="0.5" />

      {/* subject volume */}
      <ellipse cx="250" cy="290" rx="100" ry="14" fill="oklch(0.16 0.012 250)" opacity="0.6" />
      {/* dense splat-dot cluster, varied density (real) */}
      {Array.from({ length: 220 }).map((_, i) => {
        const a = ((i * 17) % 360) * (Math.PI / 180);
        const r = 12 + ((i * 31) % 95);
        const cx = 250 + Math.cos(a) * r;
        const cy = 200 + Math.sin(a) * r * 0.55;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={i % 17 === 0 ? 1.6 : 0.8}
            fill={i % 23 === 0 ? "oklch(0.74 0.14 58)" : "oklch(0.97 0.008 85)"}
            opacity={0.4 + ((i * 7) % 50) / 100}
          />
        );
      })}
      {/* nonce-QR billboard within the scene */}
      <g transform="translate(355 90)">
        <rect width="60" height="60" fill="oklch(0.97 0.008 85)" />
        {Array.from({ length: 64 }).map((_, i) => {
          const x = (i % 8) * 7 + 2;
          const y = Math.floor(i / 8) * 7 + 2;
          const filled = (i * 31) % 5 < 2;
          return filled ? <rect key={i} x={x} y={y} width="6" height="6" fill="oklch(0.16 0.012 250)" /> : null;
        })}
        <text x="0" y="-6" className="text-mono-s" fill="oklch(0.74 0.14 58)" fontSize="7">
          BOUND NONCE · IN SCENE
        </text>
      </g>
    </svg>
  );
}

function FakeLayer({ visible }: { visible: boolean }) {
  return (
    <svg
      viewBox="0 0 500 400"
      className="absolute inset-0 h-full w-full transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
      aria-hidden
    >
      <rect width="500" height="400" fill="oklch(0.21 0.014 250)" />
      {/* uniform, suspiciously perfect distribution (fake) */}
      {Array.from({ length: 220 }).map((_, i) => {
        const a = ((i * 360) / 220) * (Math.PI / 180);
        const r = 50 + (i % 4) * 11;
        const cx = 250 + Math.cos(a) * r;
        const cy = 200 + Math.sin(a) * r * 0.55;
        return <circle key={i} cx={cx} cy={cy} r={1} fill="oklch(0.97 0.008 85)" opacity="0.65" />;
      })}
      {/* missing QR, missing nonce */}
      <g transform="translate(355 90)">
        <rect width="60" height="60" fill="none" stroke="oklch(0.62 0.16 28)" strokeDasharray="3 3" strokeWidth="1" />
        <text x="30" y="36" className="text-mono-s" fill="oklch(0.62 0.16 28)" fontSize="7" textAnchor="middle">
          NO BOUND NONCE
        </text>
      </g>
    </svg>
  );
}
