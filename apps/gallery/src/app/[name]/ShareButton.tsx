"use client";

import { useState } from "react";

interface Props {
  name: string;
}

export function ShareButton({ name }: Props) {
  const [state, setState] = useState<"idle" | "copied">("idle");

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/${name}`
      : `https://app.realityproof.app/${name}`;

  async function copy() {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Proof of Reality", text: name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 1800);
    } catch {
      // User cancelled or clipboard blocked — silent.
    }
  }

  return (
    <button
      onClick={copy}
      type="button"
      className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-mono-s font-semibold transition-transform hover:translate-y-[-1px] active:translate-y-0"
      style={{
        background: "var(--color-accent)",
        color: "var(--color-accent-fg)",
        boxShadow: "0 8px 28px var(--color-accent-soft)",
      }}
    >
      {state === "copied" ? "✓ copied" : "Share this proof"}
    </button>
  );
}
