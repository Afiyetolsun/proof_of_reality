import { ensAppParentUrl, ensParentName, viewerHome } from "@/lib/viewer-link";

export function Footer() {
  return (
    <footer className="container-page rule-top mt-20 border-[--color-rule] py-10">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <span className="text-mono-s text-[--color-ink-mute]">
          indexed from{" "}
          <a
            href={ensAppParentUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[--color-ink] underline decoration-transparent underline-offset-4 hover:decoration-[--color-signal]"
          >
            {ensParentName}
          </a>{" "}
          on eth-sepolia · subnames updated every 30s
        </span>
        <div className="flex items-center gap-5 text-mono-s text-[--color-ink-mute]">
          <a
            href={viewerHome}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-transparent underline-offset-4 hover:text-[--color-ink] hover:decoration-[--color-signal]"
          >
            viewer
          </a>
          <a
            href="https://sepolia.basescan.org"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-transparent underline-offset-4 hover:text-[--color-ink] hover:decoration-[--color-signal]"
          >
            base sepolia
          </a>
        </div>
      </div>
    </footer>
  );
}
