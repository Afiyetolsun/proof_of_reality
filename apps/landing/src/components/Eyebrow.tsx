import { type ReactNode } from "react";

export function Eyebrow({
  children,
  signal = false,
}: {
  children: ReactNode;
  signal?: boolean;
}) {
  return (
    <span
      className={`text-eyebrow font-mono ${
        signal ? "text-[--color-signal]" : "text-[--color-ink-mute]"
      }`}
    >
      {children}
    </span>
  );
}
