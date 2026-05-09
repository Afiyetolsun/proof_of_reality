import Link from "next/link";
import { ensAppParentUrl, ensParentName } from "@/lib/viewer-link";

export function Header() {
  return (
    <header className="container-page flex items-center justify-between py-6">
      <Link
        href="/"
        className="text-mono text-[--color-signal]"
        aria-label="Proof of Reality gallery home"
      >
        proof of reality / gallery
      </Link>
      <nav aria-label="Primary" className="flex items-center gap-6 text-mono-s">
        <a
          href={ensAppParentUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[--color-ink-mute] underline decoration-transparent underline-offset-4 transition-colors hover:text-[--color-ink] hover:decoration-[--color-signal]"
        >
          {ensParentName} ↗
        </a>
      </nav>
    </header>
  );
}
