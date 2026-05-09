import type { Metadata } from "next";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { LegalPage } from "../../components/LegalPage";

export const metadata: Metadata = {
  title: "Terms & Conditions — Proof of Reality",
  description: "Terms and conditions for using the Proof of Reality platform.",
};

export default function TermsPage() {
  return (
    <>
      <Header />
      <LegalPage title="Terms & Conditions" updated="2026-05-01">
        <Section title="1. Overview">
          <p>
            Proof of Reality (&ldquo;the Service&rdquo;) is an experimental Web3 platform developed
            during ETHPrague 2026. It provides cryptographic proofs that physical objects exist at a
            specific place and time, anchored to orbital-sourced entropy and signed by
            hardware-resident keys. The Service is provided &ldquo;as is&rdquo; without warranty of any kind.
          </p>
        </Section>

        <Section title="2. Use of the Service">
          <p>You agree to use the Service only for lawful purposes. You must not:</p>
          <ul>
            <li>Submit fraudulent or fabricated scans;</li>
            <li>Attempt to forge, replay, or tamper with proof bundles;</li>
            <li>Use the Service in any way that violates applicable law;</li>
            <li>Exploit the platform to circumvent on-chain verification logic.</li>
          </ul>
        </Section>

        <Section title="3. Proofs are not legal documents">
          <p>
            A Reality NFT represents a cryptographically verifiable snapshot, not a legal certificate
            of ownership, authenticity, or condition. We make no representations regarding the legal
            standing of any proof in any jurisdiction.
          </p>
        </Section>

        <Section title="4. Blockchain irreversibility">
          <p>
            Minted NFTs on Base Sepolia (and eventually mainnet) are permanent on-chain records.
            We cannot reverse, delete, or modify on-chain transactions. You are responsible for the
            content you submit for minting.
          </p>
        </Section>

        <Section title="5. No warranty">
          <p>
            The Service is an experimental hackathon scaffold. It is provided without warranty of any
            kind, express or implied, including but not limited to warranties of merchantability,
            fitness for a particular purpose, or non-infringement. We do not warrant that the Service
            will be uninterrupted, error-free, or free of bugs.
          </p>
        </Section>

        <Section title="6. Limitation of liability">
          <p>
            To the maximum extent permitted by applicable law, Proof of Reality and its contributors
            shall not be liable for any indirect, incidental, special, or consequential damages
            arising from your use of the Service, including but not limited to loss of data, loss of
            profits, or service interruptions.
          </p>
        </Section>

        <Section title="7. Intellectual property">
          <p>
            The platform source code is open-source and available on{" "}
            <a
              href="https://github.com/Afiyetolsun/proof_of_reality"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            . Proof bundles you create using the Service remain yours. By using the Service you grant
            us a non-exclusive licence to store and serve your proof bundles via the Swarm network.
          </p>
        </Section>

        <Section title="8. Changes to these terms">
          <p>
            We may update these terms at any time. Continued use of the Service after changes are
            published constitutes acceptance of the new terms. The date at the top of this page
            reflects the most recent revision.
          </p>
        </Section>

        <Section title="9. Contact">
          <p>
            Questions about these terms?{" "}
            <a href="mailto:support@realityproof.app">support@realityproof.app</a>
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
