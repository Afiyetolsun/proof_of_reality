import { architectureUrl, githubUrl, viewerHome } from "../lib/viewer-link";

export function Header() {
  return (
    <header className="container-page flex items-center justify-between py-6">
      <a
        href="/"
        aria-label="Proof of Reality home"
        className="group inline-flex items-baseline font-mono text-[--color-ink] transition-colors hover:text-[--color-signal]"
        style={{
          fontSize: "clamp(1.25rem, 1.6vw, 1.625rem)",
          lineHeight: 1,
          letterSpacing: "-0.025em",
          fontWeight: 500,
        }}
      >
        <span>proof of reality</span>
        <span
          aria-hidden
          className="ml-[0.05em] text-[--color-signal] transition-transform duration-200 group-hover:translate-y-[-0.05em]"
        >
          .
        </span>
      </a>
      <nav aria-label="Primary" className="flex items-center gap-6 text-mono-s">
        <a
          href={viewerHome}
          target="_blank"
          rel="noreferrer"
          className="text-[--color-signal] underline decoration-[--color-signal] underline-offset-4 transition-colors hover:decoration-2"
        >
          app ↗
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
