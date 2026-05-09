import type { VerificationCheck } from "@/lib/verify/index.js";

interface Props {
  checks: VerificationCheck[];
}

const KIND_TOKENS = {
  ok: {
    border: "border-[oklch(0.62_0.16_145_/_0.4)]",
    bg: "bg-[oklch(0.62_0.16_145_/_0.06)]",
    fg: "bg-[oklch(0.62_0.16_145)]",
    text: "text-[oklch(0.20_0.02_250)]",
    icon: "✓",
  },
  fail: {
    border: "border-[oklch(0.62_0.16_28_/_0.4)]",
    bg: "bg-[oklch(0.62_0.16_28_/_0.06)]",
    fg: "bg-[--color-warn]",
    text: "text-[--color-ink]",
    icon: "✕",
  },
  info: {
    border: "border-[--color-rule]",
    bg: "bg-[--color-surface-raised]",
    fg: "bg-[--color-ink-mute]",
    text: "text-[--color-surface-deep]",
    icon: "i",
  },
  warn: {
    border: "border-[--color-signal-soft]",
    bg: "bg-[oklch(0.74_0.14_58_/_0.06)]",
    fg: "bg-[--color-signal]",
    text: "text-[--color-surface-deep]",
    icon: "!",
  },
} as const;

export function Badges({ checks }: Props) {
  return (
    <ul className="flex flex-col gap-2.5">
      {checks.map((c) => {
        const kind = c.kind ?? (c.ok ? "ok" : "fail");
        const t = KIND_TOKENS[kind];
        return (
          <li
            key={c.name}
            className={`flex items-start gap-3.5 border ${t.border} ${t.bg} px-3.5 py-3`}
          >
            <span
              aria-hidden
              className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-mono-s font-bold ${t.fg} ${t.text}`}
            >
              {t.icon}
            </span>
            <div className="min-w-0">
              <div className="text-body-s font-semibold text-[--color-ink]">{c.name}</div>
              <div className="text-mono-s text-[--color-ink-mute]">{c.detail}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
