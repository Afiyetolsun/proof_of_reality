/**
 * Branded 404. Catches any path that doesn't match a route — typo'd
 * URLs, removed pages, etc. The /[name] route handles its own
 * "name not found" inline so this only fires when the path itself
 * doesn't exist.
 */
import Link from "next/link";
import { LandingSearch } from "./LandingSearch";

export default function NotFound() {
  return (
    <main className="page">
      <header className="hero">
        <div style={{ fontSize: 56, marginBottom: 12 }}>🚧</div>
        <h1 style={{ fontFamily: "inherit", fontSize: "clamp(22px, 4vw, 28px)" }}>
          Nothing here
        </h1>
        <p className="hero-tag">
          That URL doesn&apos;t match any page. If you came from a shared
          link, paste the ENS handle below.
        </p>
        <div style={{ marginTop: 24 }}>
          <LandingSearch />
        </div>
      </header>
      <footer className="footer">
        <Link href="/">← Proof of Reality</Link>
      </footer>
    </main>
  );
}
