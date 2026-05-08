import { type ReactNode } from "react";

type Variant = "filled" | "ghost";

export function CTAButton({
  href,
  children,
  variant = "filled",
  external = false,
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  external?: boolean;
}) {
  const base =
    "group inline-flex items-center gap-2 px-5 py-3 text-body-s font-medium transition-colors duration-200";

  const filled =
    "bg-[--color-signal] text-[--color-surface-deep] hover:bg-[--color-signal-deep]";
  const ghost =
    "text-[--color-ink] underline decoration-[--color-signal] decoration-1 underline-offset-[6px] hover:decoration-2 hover:text-[--color-signal] px-0";

  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className={`${base} ${variant === "filled" ? filled : ghost}`}
    >
      <span>{children}</span>
      <span
        aria-hidden
        className="translate-x-0 transition-transform duration-200 group-hover:translate-x-0.5"
      >
        →
      </span>
    </a>
  );
}
