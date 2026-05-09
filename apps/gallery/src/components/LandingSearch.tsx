"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Centered search affordance on the gallery landing. Submitting routes
 * to /<name>; normalizeName() on the per-name page auto-suffixes the
 * parent realityproof.eth so users can type "vin-2c3f…" or just
 * "my-apartment" and land on the right page.
 */
export function LandingSearch() {
  const [value, setValue] = useState("");
  const router = useRouter();

  function go(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim().toLowerCase();
    if (!v) return;
    router.push(`/${encodeURIComponent(v)}`);
  }

  return (
    <form
      onSubmit={go}
      className="mx-auto mt-8 flex w-full max-w-[34rem] items-stretch gap-2"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="vin-….realityproof.eth or my-apartment"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="min-w-0 flex-1 border border-[--color-rule] bg-[--color-surface-raised] px-4 py-3 text-mono-s text-[--color-ink] placeholder:text-[--color-ink-faint] focus:border-[--color-signal] focus:outline-none"
      />
      <button
        type="submit"
        className="whitespace-nowrap bg-[--color-signal] px-5 py-3 text-mono-s font-semibold text-[--color-surface-deep] transition-opacity hover:opacity-90"
      >
        verify ↗
      </button>
    </form>
  );
}
