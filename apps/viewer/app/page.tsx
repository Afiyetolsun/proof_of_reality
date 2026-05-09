import { LandingSearch } from "./LandingSearch";

export default function HomePage() {
  return (
    <main className="page">
      <section className="landing-hero">
        <h1>Proof of Reality</h1>
        <p>
          Cryptographic capture of physical reality. Every Reality NFT carries
          four independent witnesses: a satellite-signed cosmic nonce, a Space
          Fabric KMS co-signature, a hardware-rooted device signature, and the
          on-chain mint itself.
        </p>
        <LandingSearch />
      </section>

      <section className="landing-grid">
        <div className="card">
          <h3>For renters &amp; landlords</h3>
          <p>
            Move-in / move-out scans settle deposit disputes in seconds. Send
            your landlord a link, they verify the apartment&apos;s state at
            handover.
          </p>
        </div>
        <div className="card">
          <h3>For insurance claims</h3>
          <p>
            File a claim with a cryptographically-anchored snapshot of the
            damaged item. The adjuster reads one ENS handle and gets a
            time-stamped, signed proof.
          </p>
        </div>
        <div className="card">
          <h3>For high-value provenance</h3>
          <p>
            Watches, art, luxury bags. Each sale appends a Reality NFT showing
            the object&apos;s state. Buyers audit the chain before they pay.
          </p>
        </div>
      </section>

      <footer className="footer">
        <span>Built for ETHPrague 2026 · SpaceComputer + ENS + Swarm</span>
        <a href="https://github.com/Afiyetolsun/proof_of_reality" target="_blank" rel="noreferrer">
          GitHub ↗
        </a>
      </footer>
    </main>
  );
}
