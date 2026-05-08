import { type ReactNode } from "react";

export function Mono({
  children,
  className = "",
  truncate = false,
}: {
  children: ReactNode;
  className?: string;
  truncate?: boolean;
}) {
  return (
    <code
      className={`text-mono text-[--color-ink] opacity-90 ${
        truncate ? "block max-w-full overflow-hidden text-ellipsis whitespace-nowrap" : ""
      } ${className}`}
    >
      {children}
    </code>
  );
}

export function shortHex(hex: string, head = 8, tail = 6): string {
  if (!hex || hex.length <= head + tail + 3) return hex;
  return `${hex.slice(0, head)}…${hex.slice(-tail)}`;
}
