"use client";

import { useEffect, useRef, useState } from "react";

type Witness = {
  index: string;
  title: string;
  source: string;
  detail: string;
  glyph: "satellite" | "cosig" | "key" | "swarm" | "attest";
};

const WITNESSES: Witness[] = [
  {
    index: "①",
    title: "Cosmic nonce",
    source: "Orbitport · cTRNG · aptosorbital",
    detail:
      "A satellite signs a fresh random number. Bound to the scan in the moment of capture; replaying it requires predicting orbit-time.",
    glyph: "satellite",
  },
  {
    index: "②",
    title: "KMS co-signature",
    source: "SpaceComputer Space Fabric",
    detail:
      "After the device signs, an off-chain TEE counter-signs the bundle hash. A second independent witness on every mint.",
    glyph: "cosig",
  },
  {
    index: "③",
    title: "Device key",
    source: "Apple Secure Enclave · USB Armory ECDSA",
    detail:
      "The capture device proves the bundle came from real hardware. Public key registered on-chain at provisioning.",
    glyph: "key",
  },
  {
    index: "④",
    title: "Swarm CAC",
    source: "Bee · BMT chunk root",
    detail:
      "The bundle's Swarm reference is its content hash. Re-fetch and verify; no gateway trust required.",
    glyph: "swarm",
  },
  {
    index: "⑤",
    title: "App Attest",
    source: "Apple · iOS captures only",
    detail:
      "Optional fifth witness on B2C. Apple attests that the app binary is genuine, not a tampered build.",
    glyph: "attest",
  },
];

export function WitnessDiagram() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            obs.unobserve(e.target);
          }
        });
      },
      { rootMargin: "-100px 0px" },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="container-page">
      <div className="grid grid-cols-1 gap-x-6 gap-y-12 md:grid-cols-5">
        {WITNESSES.map((w, i) => (
          <article
            key={w.index}
            className="group relative"
            style={{
              opacity: shown ? 1 : 0,
              transform: shown ? "translateY(0)" : "translateY(14px)",
              transition: `opacity 240ms cubic-bezier(0.165,0.84,0.44,1) ${i * 80}ms, transform 240ms cubic-bezier(0.165,0.84,0.44,1) ${i * 80}ms`,
            }}
          >
            <div className="aspect-[4/5] border border-[--color-rule] bg-[--color-surface-raised] p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-display-m text-[--color-signal] leading-none">{w.index}</span>
                <span className="text-mono-s text-[--color-ink-mute]">WITNESS</span>
              </div>
              <div className="mt-6 h-32">
                <Glyph kind={w.glyph} animate={shown} delay={i * 80 + 200} />
              </div>
              <h3 className="mt-4 text-h2 text-[--color-ink]" style={{ fontSize: "1.375rem" }}>
                {w.title}
              </h3>
              <div className="mt-1 text-mono-s text-[--color-ink-mute]">{w.source}</div>
            </div>
            <p className="mt-4 max-read text-body-s text-[--color-ink-mute]">{w.detail}</p>
          </article>
        ))}
      </div>
      <p className="mt-14 max-read text-body text-[--color-ink-mute]">
        Five independent witnesses on every scan. To forge one, you would need to break all five at once: predict an
        orbital nonce, mint a counterfeit signature on a TEE you don't control, extract a key from hardware that
        won't release it, recompute a content address, and bypass App Attest. The math gets unkind very quickly.
      </p>
    </div>
  );
}

function Glyph({ kind, animate, delay }: { kind: Witness["glyph"]; animate: boolean; delay: number }) {
  const drawStyle = (length: number): React.CSSProperties => ({
    strokeDasharray: length,
    strokeDashoffset: animate ? 0 : length,
    transition: `stroke-dashoffset 700ms cubic-bezier(0.165,0.84,0.44,1) ${delay}ms`,
  });

  if (kind === "satellite") {
    return (
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
        <circle cx="40" cy="65" r="14" fill="none" stroke="oklch(0.30 0.014 250)" strokeWidth="0.6" />
        <circle cx="40" cy="65" r="22" fill="none" stroke="oklch(0.30 0.014 250)" strokeWidth="0.4" strokeDasharray="2 4" />
        <ellipse cx="40" cy="65" rx="34" ry="6" fill="none" stroke="oklch(0.30 0.014 250)" strokeWidth="0.4" />
        <circle cx="74" cy="50" r="2" fill="oklch(0.74 0.14 58)" />
        <path d="M 74 50 Q 60 30 40 50" fill="none" stroke="oklch(0.74 0.14 58)" strokeWidth="0.8" style={drawStyle(60)} />
      </svg>
    );
  }
  if (kind === "cosig") {
    return (
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
        <rect x="20" y="40" width="60" height="30" fill="none" stroke="oklch(0.30 0.014 250)" strokeWidth="0.6" />
        <line x1="50" y1="40" x2="50" y2="70" stroke="oklch(0.30 0.014 250)" strokeWidth="0.4" strokeDasharray="2 3" />
        <text x="35" y="60" fontSize="9" fill="oklch(0.74 0.14 58)" fontFamily="ui-monospace, monospace">σ₁</text>
        <text x="60" y="60" fontSize="9" fill="oklch(0.74 0.14 58)" fontFamily="ui-monospace, monospace">σ₂</text>
        <path d="M 35 75 Q 50 90 65 75" fill="none" stroke="oklch(0.74 0.14 58)" strokeWidth="0.8" style={drawStyle(40)} />
      </svg>
    );
  }
  if (kind === "key") {
    return (
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
        <rect x="20" y="20" width="60" height="60" fill="none" stroke="oklch(0.30 0.014 250)" strokeWidth="0.6" />
        <rect x="32" y="32" width="36" height="36" fill="none" stroke="oklch(0.30 0.014 250)" strokeWidth="0.4" />
        <circle cx="50" cy="50" r="6" fill="none" stroke="oklch(0.74 0.14 58)" strokeWidth="0.8" style={drawStyle(40)} />
        <line x1="50" y1="50" x2="80" y2="20" stroke="oklch(0.74 0.14 58)" strokeWidth="0.8" style={drawStyle(45)} />
        <line x1="74" y1="20" x2="80" y2="20" stroke="oklch(0.74 0.14 58)" strokeWidth="0.8" />
        <line x1="80" y1="20" x2="80" y2="26" stroke="oklch(0.74 0.14 58)" strokeWidth="0.8" />
      </svg>
    );
  }
  if (kind === "swarm") {
    return (
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
        {Array.from({ length: 7 }).map((_, i) => {
          const a = (i / 7) * Math.PI * 2;
          const x = 50 + Math.cos(a) * 24;
          const y = 50 + Math.sin(a) * 24;
          return <circle key={i} cx={x} cy={y} r="3" fill="oklch(0.30 0.014 250)" />;
        })}
        <circle cx="50" cy="50" r="6" fill="oklch(0.74 0.14 58)" />
        {Array.from({ length: 7 }).map((_, i) => {
          const a = (i / 7) * Math.PI * 2;
          const x = 50 + Math.cos(a) * 24;
          const y = 50 + Math.sin(a) * 24;
          return (
            <line
              key={i}
              x1="50"
              y1="50"
              x2={x}
              y2={y}
              stroke="oklch(0.74 0.14 58)"
              strokeWidth="0.4"
              style={drawStyle(28)}
            />
          );
        })}
      </svg>
    );
  }
  // attest
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      <path
        d="M 50 18 L 78 30 L 78 56 Q 78 78 50 88 Q 22 78 22 56 L 22 30 Z"
        fill="none"
        stroke="oklch(0.30 0.014 250)"
        strokeWidth="0.6"
      />
      <path
        d="M 36 52 L 46 62 L 66 38"
        fill="none"
        stroke="oklch(0.74 0.14 58)"
        strokeWidth="1.2"
        style={drawStyle(50)}
      />
    </svg>
  );
}
