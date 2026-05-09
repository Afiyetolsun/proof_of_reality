import { type ReactNode } from "react";

export function Mono({
  children,
  className = "",
  truncate = false,
  title,
}: {
  children: ReactNode;
  className?: string;
  truncate?: boolean;
  title?: string;
}) {
  return (
    <code
      title={title}
      className={`text-mono text-[--color-ink] opacity-90 ${
        truncate ? "block max-w-full overflow-hidden text-ellipsis whitespace-nowrap" : ""
      } ${className}`}
    >
      {children}
    </code>
  );
}

export function shortHex(hex: string | null | undefined, head = 8, tail = 6): string {
  if (!hex) return "";
  if (hex.length <= head + tail + 3) return hex;
  return `${hex.slice(0, head)}…${hex.slice(-tail)}`;
}

export function shortAddress(addr: string | null | undefined): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
