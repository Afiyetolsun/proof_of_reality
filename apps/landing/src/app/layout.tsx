import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Proof of Reality — Web3 oracle for the physical world",
  description:
    "Cryptographic proof that an object exists in physical space, here, now. Five independent witnesses on every scan: cosmic nonce, KMS co-signature, hardware-resident device key, Swarm content addressing, App Attest.",
  metadataBase: new URL("https://realityproof.app"),
  openGraph: {
    title: "Proof of Reality",
    description:
      "Five witnesses on every scan. Not generatable by AI, not pre-recordable, not forgeable on the ground.",
    url: "https://realityproof.app",
    siteName: "Proof of Reality",
    type: "website",
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
};

export const viewport: Viewport = {
  themeColor: "oklch(0.16 0.012 250)",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[--color-surface-raised] focus:px-3 focus:py-2 focus:text-[--color-ink]"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
