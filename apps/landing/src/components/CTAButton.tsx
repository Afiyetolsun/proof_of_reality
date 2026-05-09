import { type ReactNode } from "react";

type Variant = "filled" | "ghost";
type Size = "md" | "lg";

export function CTAButton({
  href,
  children,
  variant = "filled",
  size = "md",
  external = false,
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  external?: boolean;
}) {
  const base =
    "group inline-flex items-center gap-2 font-medium transition-colors duration-200";

  const sizing =
    size === "lg"
      ? "px-7 py-4 text-body"
      : "px-5 py-3 text-body-s";

  const filled =
    size === "lg"
      ? "bg-[--color-signal] text-[--color-surface-deep] shadow-[0_0_0_1px_var(--color-signal),0_8px_24px_-8px_var(--color-signal)] hover:bg-[--color-signal-deep]"
      : "bg-[--color-signal] text-[--color-surface-deep] hover:bg-[--color-signal-deep]";
  const ghost =
    "text-[--color-ink] underline decoration-[--color-signal] decoration-1 underline-offset-[6px] hover:decoration-2 hover:text-[--color-signal] px-0";

  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className={`${base} ${variant === "filled" ? `${sizing} ${filled}` : ghost}`}
    >
      <span>{children}</span>
      <span
        aria-hidden
        className={`translate-x-0 transition-transform duration-200 group-hover:translate-x-0.5 ${size === "lg" ? "text-h2" : ""}`}
      >
        →
      </span>
    </a>
  );
}
