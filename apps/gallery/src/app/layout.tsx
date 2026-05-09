import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gallery — Proof of Reality",
  description:
    "Browse every Reality NFT minted on Base Sepolia. Each card is a physical-world scan with five independent witnesses; click through to verify.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_GALLERY_BASE_URL ?? "http://localhost:3002",
  ),
  openGraph: {
    title: "Proof of Reality — Gallery",
    description:
      "Every Reality NFT, indexed from ENS. Click any card to verify its five signatures.",
    type: "website",
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
