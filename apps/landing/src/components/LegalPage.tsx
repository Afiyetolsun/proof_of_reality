import { type ReactNode } from "react";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main
      id="content"
      className="container-page py-24 md:py-32"
    >
      <div className="mx-auto max-w-3xl">
        <div className="text-mono-s text-[--color-signal]">LEGAL</div>
        <h1 className="mt-4 text-display-l text-[--color-ink]">{title}</h1>
        <p className="mt-3 text-mono-s text-[--color-ink-mute]">
          Last updated: {updated}
        </p>

        <div className="mt-16 legal-prose">
          {children}
        </div>
      </div>
    </main>
  );
}
