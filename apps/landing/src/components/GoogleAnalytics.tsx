"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

export function GoogleAnalytics({ id }: { id: string }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const check = () => {
      setEnabled(localStorage.getItem("cookie-consent") === "granted");
    };
    check();
    window.addEventListener("cookie-consent-granted", check);
    return () => window.removeEventListener("cookie-consent-granted", check);
  }, []);

  if (!enabled || !id) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${id}', { anonymize_ip: true });
      `}</Script>
    </>
  );
}
