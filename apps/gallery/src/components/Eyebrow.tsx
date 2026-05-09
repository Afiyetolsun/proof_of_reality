import { type ReactNode } from "react";

export function Eyebrow({
  children,
  signal = false,
  className = "",
}: {
  children: ReactNode;
  signal?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`text-eyebrow font-mono ${
        signal ? "text-[--color-signal]" : "text-[--color-ink-mute]"
      } ${className}`}
    >
      {children}
    </span>
  );
}
