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
      className="inline-flex items-center gap-2 rounded-full bg-[--color-signal] px-5 py-2.5 text-mono-s font-semibold text-[--color-surface-deep] transition-transform hover:translate-y-[-1px] active:translate-y-0"
    >
      {state === "copied" ? "✓ copied" : "share this proof"}
    </button>
  );
}
