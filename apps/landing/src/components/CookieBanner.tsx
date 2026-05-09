"use client";

import { useEffect, useState } from "react";
import { trackCookieConsent } from "../lib/analytics";

type Consent = "granted" | "declined" | null;

const STORAGE_KEY = "cookie-consent";

export function CookieBanner() {
  const [consent, setConsent] = useState<Consent>("granted"); // start hidden to avoid flash

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Consent | null;
    setConsent(stored);
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, "granted");
    setConsent("granted");
    window.dispatchEvent(new Event("cookie-consent-granted"));
    trackCookieConsent("granted");
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, "declined");
    setConsent("declined");
    trackCookieConsent("declined");
  }

  if (consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[--color-rule] bg-[--color-surface-raised] px-4 py-5 md:px-8"
    >
      <div className="container-page flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-body-s text-[--color-ink-mute] max-w-prose">
          We use cookies for analytics (Google Analytics 4). No personal data is sold or shared with
          third parties.{" "}
          <a
            href="/cookies"
            className="text-[--color-ink] underline underline-offset-4 decoration-transparent hover:decoration-[--color-signal] transition-colors"
          >
            Cookie policy
          </a>
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={decline}
            className="text-mono-s text-[--color-ink-mute] underline underline-offset-4 decoration-transparent hover:text-[--color-ink] hover:decoration-[--color-rule] transition-colors"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="rounded-none border border-[--color-signal] bg-transparent px-4 py-2 text-mono-s text-[--color-signal] transition-colors hover:bg-[--color-signal] hover:text-[--color-surface-deep]"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
