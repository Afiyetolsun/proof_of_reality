import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { CookieBanner } from "../components/CookieBanner";
import { GoogleAnalytics } from "../components/GoogleAnalytics";
import { AnalyticsEvents } from "../components/AnalyticsEvents";
import "./globals.css";

const SITE_URL = "https://realityproof.app";
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Proof of Reality — Web3 oracle for the physical world",
    template: "%s — Proof of Reality",
  },
  description:
    "Cryptographic proof that an object exists in physical space, here, now. Five independent witnesses on every scan: cosmic nonce, KMS co-signature, hardware-resident device key, Swarm content addressing, App Attest.",
  keywords: [
    "Web3 oracle",
    "physical world verification",
    "NFT authenticity",
    "cryptographic proof",
    "RWA",
    "SpaceComputer",
    "ETHPrague 2026",
    "proof of existence",
  ],
  authors: [{ name: "Proof of Reality", url: SITE_URL }],
  creator: "Proof of Reality",
  openGraph: {
    title: "Proof of Reality",
    description:
      "Five witnesses on every scan. Not generatable by AI, not pre-recordable, not forgeable on the ground.",
    url: SITE_URL,
    siteName: "Proof of Reality",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Proof of Reality — Web3 oracle for the physical world",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Proof of Reality",
    description:
      "Web3 oracle for the physical world. Orbital-anchored verification of physical objects.",
    images: ["/og-image.png"],
    site: "@ProofReality",
    creator: "@ProofReality",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.svg",
  },
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "oklch(0.16 0.012 250)",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Proof of Reality",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/brand/mark.svg`,
      },
      sameAs: [
        "https://x.com/ProofReality",
        "https://t.me/ProofReality",
        "https://github.com/Afiyetolsun/proof_of_reality",
      ],
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "support@realityproof.app",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Proof of Reality",
      description:
        "Web3 oracle for the physical world. Cryptographic proof that an object exists in physical space, here, now.",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: "Proof of Reality",
      applicationCategory: "BlockchainApplication",
      operatingSystem: "Web, iOS",
      url: "https://app.realityproof.app",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[--color-surface-raised] focus:px-3 focus:py-2 focus:text-[--color-ink]"
        >
          Skip to content
        </a>
        {children}
        <CookieBanner />
        {GA_ID && <GoogleAnalytics id={GA_ID} />}
        <AnalyticsEvents />
        {/* model-viewer web component for the .glb mesh viewers in <RealVsFake> */}
        <Script
          type="module"
          src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
