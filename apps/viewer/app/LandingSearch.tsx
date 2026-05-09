"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <form className="landing-search" onSubmit={go}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="vin-….realityproof.eth or your-name"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <button type="submit">Verify</button>
    </form>
  );
}
