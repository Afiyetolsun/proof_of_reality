"use client";

import { useEffect, useRef, useState } from "react";

type NonceData = { nonce: string; src?: string | null };

// Round trig-derived coordinates to 2 decimals so SVG attrs are byte-identical
// across Node SSR and browser hydration (V8 Math.sin/cos can diverge on the
// last digit between engines).
const round = (n: number) => Math.round(n * 100) / 100;

export function HeroOrbital() {
  const [nonce, setNonce] = useState<string>("0a4c2ea21557418bbc1d57120142ad83e8fa6e030ad35125fe225b97929d2526");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    let abort = false;
    fetch("/api/nonce", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: NonceData | null) => {
        if (abort || !j?.nonce) return;
        setNonce(j.nonce);
      })
      .catch(() => {});
    return () => {
      abort = true;
    };
  }, []);

  const short = `${nonce.slice(0, 8)} … ${nonce.slice(-8)}`;

  return (
    <div
      ref={wrapRef}
      className="relative aspect-square w-full select-none"
      role="img"
      aria-label="Orbital diagram: a captured object on the ground anchored to a satellite-borne random nonce"
    >
      {/* Outer reticle */}
      <svg
        viewBox="0 0 400 400"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.74 0.14 58)" stopOpacity="0.55" />
            <stop offset="60%" stopColor="oklch(0.74 0.14 58)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="oklch(0.74 0.14 58)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="signal-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.74 0.14 58)" stopOpacity="0" />
            <stop offset="50%" stopColor="oklch(0.74 0.14 58)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="oklch(0.74 0.14 58)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* core glow */}
        <circle cx="200" cy="200" r="120" fill="url(#core-glow)" />

        {/* concentric reticle rings */}
        {[60, 110, 160, 192].map((r, i) => (
          <circle
            key={r}
            cx="200"
            cy="200"
            r={r}
            fill="none"
            stroke="oklch(0.30 0.014 250)"
            strokeWidth={i === 3 ? 1 : 0.6}
            strokeDasharray={i === 1 ? "1 6" : i === 2 ? "2 9" : undefined}
          />
        ))}

        {/* ground crosshair */}
        <line x1="0" y1="200" x2="400" y2="200" stroke="oklch(0.30 0.014 250)" strokeWidth="0.4" strokeDasharray="2 6" />
        <line x1="200" y1="0" x2="200" y2="400" stroke="oklch(0.30 0.014 250)" strokeWidth="0.4" strokeDasharray="2 6" />

        {/* slow orbiting satellite group */}
        <g
          style={{
            transformOrigin: "200px 200px",
            animation: reduce ? undefined : "orbit-slow 38s linear infinite",
          }}
        >
          <circle cx="360" cy="200" r="3" fill="oklch(0.74 0.14 58)" />
          <circle cx="360" cy="200" r="9" fill="none" stroke="oklch(0.74 0.14 58)" strokeWidth="0.5" opacity="0.4" />
          <line
            x1="200"
            y1="200"
            x2="357"
            y2="200"
            stroke="url(#signal-line)"
            strokeWidth="1"
            opacity="0.7"
          />
        </g>

        {/* counter-orbit secondary marker */}
        <g
          style={{
            transformOrigin: "200px 200px",
            animation: reduce ? undefined : "orbit-slow 64s linear reverse infinite",
          }}
        >
          <circle cx="40" cy="200" r="1.6" fill="oklch(0.74 0.14 58)" opacity="0.7" />
        </g>

        {/* faint particle field */}
        {Array.from({ length: 26 }).map((_, i) => {
          const a = (i / 26) * Math.PI * 2;
          const r = 70 + ((i * 13) % 110);
          const x = round(200 + Math.cos(a) * r);
          const y = round(200 + Math.sin(a) * r);
          const op = 0.18 + ((i * 7) % 30) / 100;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={i % 5 === 0 ? 1.2 : 0.7}
              fill="oklch(0.97 0.008 85)"
              opacity={op}
            />
          );
        })}

        {/* central object silhouette: simplified Gaussian-splat-style volume */}
        <g opacity="0.92">
          <ellipse cx="200" cy="218" rx="58" ry="14" fill="oklch(0.21 0.014 250)" />
          <path
            d="M 165 218 Q 165 175 200 165 Q 235 175 235 218 Z"
            fill="oklch(0.74 0.14 58)"
            opacity="0.18"
          />
          <path
            d="M 168 215 Q 168 178 200 168 Q 232 178 232 215"
            fill="none"
            stroke="oklch(0.74 0.14 58)"
            strokeWidth="1"
            opacity="0.55"
          />
          {/* inner splat-dots */}
          {Array.from({ length: 80 }).map((_, i) => {
            const t = i / 80;
            const a = t * Math.PI * 2 * 3;
            const rr = 12 + (i % 7) * 4;
            const cx = round(200 + Math.cos(a) * rr * (1 - t * 0.5));
            const cy = round(195 + Math.sin(a) * rr * 0.55 * (1 - t * 0.4));
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={i % 11 === 0 ? 1.8 : 0.9}
                fill={i % 13 === 0 ? "oklch(0.74 0.14 58)" : "oklch(0.97 0.008 85)"}
                opacity={0.35 + (i % 5) * 0.1}
              />
            );
          })}
        </g>

        {/* corner brackets */}
        {([
          [20, 20],
          [380, 20],
          [20, 380],
          [380, 380],
        ] as const).map(([x, y], i) => {
          const dx = i % 2 === 0 ? 1 : -1;
          const dy = i < 2 ? 1 : -1;
          return (
            <g key={i} stroke="oklch(0.74 0.14 58)" strokeWidth="1" fill="none" opacity="0.7">
              <line x1={x} y1={y} x2={x + dx * 14} y2={y} />
              <line x1={x} y1={y} x2={x} y2={y + dy * 14} />
            </g>
          );
        })}
      </svg>

      {/* nonce label, lower right */}
      <div className="pointer-events-none absolute bottom-3 right-3 max-w-[80%] text-right">
        <div className="text-mono-s text-[--color-ink-mute]">
          BOUND COSMIC NONCE
        </div>
        <div className="text-mono text-[--color-signal]">
          {short}
        </div>
      </div>

      {/* signature label, upper left */}
      <div className="pointer-events-none absolute left-3 top-3 max-w-[60%]">
        <div className="text-mono-s text-[--color-ink-mute]">
          ECDSA · P-256 · SECURE ENCLAVE
        </div>
      </div>
    </div>
  );
}

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const handler = () => setReduce(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduce;
}
