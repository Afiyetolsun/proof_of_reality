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
      className={`relative ${bleed ? "" : "container-page"} py-20 md:py-28 ${
        rule ? "rule-top border-[--color-rule]" : ""
      }`}
    >
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
        <div className={`${bleed ? "" : ""} ${eyebrow || display ? "mt-14 md:mt-20" : ""}`}>
          {children}
        </div>
      )}
    </section>
  );
}
