"use client";

import { useState } from "react";

interface Props {
  name: string;
}

/** Copy-to-clipboard button. Shows a transient "Copied!" state. */
export function ShareButton({ name }: Props) {
  const [state, setState] = useState<"idle" | "copied">("idle");

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/${name}`
      : `https://realityproof.app/${name}`;

  async function copy() {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        // Use native share sheet on mobile when available — better UX
        // than copying a URL the user then has to paste somewhere.
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
    <button onClick={copy} className="share-btn" type="button">
      {state === "copied" ? "✓ Copied" : "Share this proof"}
    </button>
  );
}
