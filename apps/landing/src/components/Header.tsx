import { architectureUrl, githubUrl, viewerHome } from "../lib/viewer-link";

export function Header() {
  return (
    <header className="container-page flex items-center justify-between py-6">
      <a href="/" className="text-mono text-[--color-signal]" aria-label="Proof of Reality home">
        proof of reality.
      </a>
      <nav aria-label="Primary" className="flex items-center gap-6 text-mono-s">
        <a
          href={viewerHome}
          target="_blank"
          rel="noreferrer"
          className="text-[--color-ink-mute] underline decoration-transparent underline-offset-4 transition-colors hover:text-[--color-ink] hover:decoration-[--color-signal]"
        >
          verify
        </a>
        <a
          href={architectureUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[--color-ink-mute] underline decoration-transparent underline-offset-4 transition-colors hover:text-[--color-ink] hover:decoration-[--color-signal]"
        >
          architecture
        </a>
        <a
          href={githubUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[--color-ink-mute] underline decoration-transparent underline-offset-4 transition-colors hover:text-[--color-ink] hover:decoration-[--color-signal]"
        >
          github
        </a>
      </nav>
    </header>
  );
}
