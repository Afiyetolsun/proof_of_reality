import { type ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";

export function Section({
  id,
  eyebrow,
  index,
  display,
  intro,
  children,
  rule = true,
  bleed = false,
}: {
  id?: string;
  eyebrow?: ReactNode;
  index?: string;
  display?: ReactNode;
  intro?: ReactNode;
  children?: ReactNode;
  rule?: boolean;
  bleed?: boolean;
}) {
  return (
    <section
      id={id}
      className={`relative ${bleed ? "" : "container-page"} py-24 md:py-32`}
    >
      {rule && (
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 h-px ${
            bleed ? "" : "container-page"
          }`}
        >
          <div className="h-full w-full bg-gradient-to-r from-transparent via-[--color-rule] to-transparent opacity-60" />
        </div>
      )}
      {(eyebrow || index || display || intro) && (
        <header className={`${bleed ? "container-page" : ""} grid grid-cols-12 gap-x-6 gap-y-8`}>
          <div className="col-span-12 flex items-baseline justify-between md:col-span-4">
            {index ? (
              <span className="text-mono-s text-[--color-ink-mute]">{index}</span>
            ) : (
              <span />
            )}
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          </div>
          <div className="col-span-12 md:col-span-8">
            {display && <h2 className="text-display-l text-[--color-ink]">{display}</h2>}
            {intro && (
              <p className="mt-6 max-read text-body text-[--color-ink-mute]">{intro}</p>
            )}
          </div>
        </header>
      )}
      {children && (
        <div className={`${bleed ? "" : ""} ${eyebrow || display ? "mt-16 md:mt-24" : ""}`}>
          {children}
        </div>
      )}
    </section>
  );
}
