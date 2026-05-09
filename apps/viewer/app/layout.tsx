import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Proof of Reality",
  description: "Web3 oracle for the physical world. ETHPrague 2026.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Proof of Reality",
    description: "Verify a physical-world proof. Five witnesses, on chain.",
    siteName: "Proof of Reality",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Proof of Reality" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Proof of Reality",
    description: "Verify a physical-world proof. Five witnesses, on chain.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning on <html>: browser extensions (Penumbra,
    // dark-mode helpers, etc) routinely inject className/style on the
    // root before React hydrates. Without this, every user with a
    // wallet extension sees a noisy "tree didn't match" overlay even
    // though the mismatch is purely cosmetic.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
