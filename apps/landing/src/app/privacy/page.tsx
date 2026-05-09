import type { Metadata } from "next";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { LegalPage } from "../../components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — Proof of Reality",
  description: "How Proof of Reality collects and uses your data.",
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <LegalPage title="Privacy Policy" updated="2026-05-01">
        <Section title="1. Who we are">
          <p>
            Proof of Reality is an open-source Web3 platform developed for ETHPrague 2026.
            Contact: <a href="mailto:support@realityproof.app">support@realityproof.app</a>
          </p>
        </Section>

        <Section title="2. Data we collect">
          <p>We collect the following data:</p>
          <ul>
            <li>
              <strong>Contact form submissions</strong> — your contact method (email, phone, or
              Telegram handle) and message. Forwarded to our Telegram notification channel and not
              stored in any database beyond what Telegram retains.
            </li>
            <li>
              <strong>Analytics data</strong> — if you accept cookies, Google Analytics 4 collects
              anonymised usage data (pages visited, session duration, geographic region, device type).
              IP addresses are anonymised before storage.
            </li>
            <li>
              <strong>Request metadata</strong> — when you submit the contact form, we log
              IP-derived country/city (from Cloudflare headers) for abuse prevention. This is not
              retained beyond the Telegram message.
            </li>
            <li>
              <strong>Blockchain data</strong> — proof bundles you mint are stored permanently on
              the Swarm network and on-chain. This is public and cannot be deleted.
            </li>
          </ul>
        </Section>

        <Section title="3. How we use your data">
          <ul>
            <li>To respond to contact form enquiries;</li>
            <li>To detect and prevent abuse;</li>
            <li>To understand how visitors interact with the site (analytics, with consent);</li>
            <li>To operate the proof minting and verification pipeline.</li>
          </ul>
          <p>We do not sell, rent, or share your personal data with third parties for marketing.</p>
        </Section>

        <Section title="4. Legal basis (GDPR)">
          <p>
            For EEA/UK users, we process your data on the following bases:
          </p>
          <ul>
            <li>
              <strong>Legitimate interests</strong> — contact form metadata, abuse prevention;
            </li>
            <li>
              <strong>Consent</strong> — Google Analytics 4 (you may withdraw via the cookie
              banner or by clearing your browser&rsquo;s localStorage);
            </li>
            <li>
              <strong>Contract</strong> — operating the proof pipeline when you use the app.
            </li>
          </ul>
        </Section>

        <Section title="5. Third-party services">
          <ul>
            <li>
              <strong>Google Analytics 4</strong> — analytics, only loaded after consent. Governed
              by Google&rsquo;s Privacy Policy.
            </li>
            <li>
              <strong>Telegram</strong> — receives contact form submissions. Governed by
              Telegram&rsquo;s Privacy Policy.
            </li>
            <li>
              <strong>Swarm / Ethswarm</strong> — decentralised storage for proof bundles (public,
              immutable).
            </li>
            <li>
              <strong>Base / Ethereum</strong> — on-chain NFT minting (public, immutable).
            </li>
            <li>
              <strong>SpaceComputer Orbitport</strong> — satellite-anchored nonce and KMS
              co-signature service.
            </li>
          </ul>
        </Section>

        <Section title="6. Cookies">
          <p>
            We use cookies only for analytics (Google Analytics 4), and only after you give consent
            via the cookie banner. See our{" "}
            <a href="/cookies">Cookie Policy</a> for details.
          </p>
        </Section>

        <Section title="7. Data retention">
          <p>
            Contact form data is retained only for as long as needed to respond to your enquiry.
            Analytics data is retained for 14 months by default in Google Analytics. On-chain and
            Swarm data is permanent and cannot be deleted.
          </p>
        </Section>

        <Section title="8. Your rights">
          <p>
            Under GDPR you have the right to access, rectify, erase, restrict, or object to
            processing of your personal data. To exercise these rights or to withdraw consent for
            analytics, contact{" "}
            <a href="mailto:support@realityproof.app">support@realityproof.app</a>. Note that
            on-chain and Swarm data is outside our control and cannot be erased.
          </p>
        </Section>

        <Section title="9. Changes to this policy">
          <p>
            We may update this policy at any time. The date at the top of this page reflects the
            most recent revision. Material changes will be noted in the site changelog.
          </p>
        </Section>
      </LegalPage>
      <Footer />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
