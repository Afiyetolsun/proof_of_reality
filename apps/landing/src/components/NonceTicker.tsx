"use client";

import { useEffect, useRef, useState } from "react";

type NonceData = {
  nonce: string;
  src?: string | null;
  issuedAt?: number | null;
  fresh?: boolean;
};

const REFRESH_MS = 12_000;

export function NonceTicker() {
  const [data, setData] = useState<NonceData | null>(null);
  const [flicker, setFlicker] = useState(false);
  const lastNonce = useRef<string | null>(null);

  useEffect(() => {
    let abort = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/nonce", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as NonceData;
        if (abort) return;
        setData(json);
        if (lastNonce.current && lastNonce.current !== json.nonce) {
          setFlicker(true);
          setTimeout(() => setFlicker(false), 220);
        }
        lastNonce.current = json.nonce;
      } catch {
        // silent
      }
    };
    tick();
    const id = window.setInterval(tick, REFRESH_MS);
    return () => {
      abort = true;
      window.clearInterval(id);
    };
  }, []);

  const nonce = data?.nonce ?? "0000000000000000000000000000000000000000000000000000000000000000";
  const src = data?.src ?? "—";
  const fresh = Boolean(data?.fresh);
  const status = fresh ? "LIVE" : data ? "FALLBACK" : "WAITING";

  const segment = `cTRNG · ${src.toUpperCase()} · ${nonce} · sat·sig·verified · `;
  const stripContent = segment.repeat(3);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Cosmic random nonce, source ${src}, status ${status.toLowerCase()}`}
      className="relative w-full border-b border-[--color-rule] bg-[--color-surface-deep]"
    >
      <div className="container-page flex items-center gap-4 py-1.5">
        <span className="hidden shrink-0 items-center gap-2 md:inline-flex">
          <span
            aria-hidden
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              fresh ? "bg-[--color-signal]" : "bg-[--color-ink-faint]"
            }`}
            style={{
              animation: fresh ? "flicker 2.4s var(--ease-out-quart) infinite" : undefined,
            }}
          />
          <span className="text-mono-s text-[--color-ink-mute]">
            COSMIC NONCE · {status}
          </span>
        </span>

        <div className="relative flex-1 overflow-hidden whitespace-nowrap">
          <div
            className="text-mono-s text-[--color-signal]"
            style={{
              animation: "marquee 60s linear infinite",
              willChange: "transform",
              opacity: flicker ? 0.4 : 1,
              transition: "opacity 220ms var(--ease-out-quart)",
            }}
          >
            {stripContent}
          </div>
        </div>
      </div>
    </div>
  );
}
