import type { Metadata } from "next";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { LegalPage } from "../../components/LegalPage";

export const metadata: Metadata = {
  title: "Cookie Policy — Proof of Reality",
  description: "How Proof of Reality uses cookies and how to manage your preferences.",
};

export default function CookiesPage() {
  return (
    <>
      <Header />
      <LegalPage title="Cookie Policy" updated="2026-05-01">
        <Section title="1. What are cookies?">
          <p>
            Cookies are small text files stored in your browser by websites you visit. This site
            also uses <code>localStorage</code> (a browser storage mechanism) to remember your
            cookie consent preference.
          </p>
        </Section>

        <Section title="2. Cookies we use">
          <table>
            <thead>
              <tr>
                <th>Name / key</th>
                <th>Type</th>
                <th>Purpose</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>cookie-consent</code></td>
                <td>localStorage</td>
                <td>Remembers your cookie consent choice (no analytics until &ldquo;granted&rdquo;)</td>
                <td>Indefinite (until cleared)</td>
              </tr>
              <tr>
                <td><code>_ga</code>, <code>_ga_*</code></td>
                <td>Analytics</td>
                <td>Google Analytics 4 — distinguishes users and sessions</td>
                <td>2 years / 24 hours</td>
              </tr>
            </tbody>
          </table>
          <p>
            GA4 cookies are set <strong>only after you click &ldquo;Accept&rdquo;</strong> on the
            cookie banner. If you decline, no analytics cookies are set.
          </p>
        </Section>

        <Section title="3. Essential vs non-essential">
          <p>
            The <code>cookie-consent</code> localStorage key is essential — it prevents the banner
            from appearing on every page load. It does not track you.
          </p>
          <p>
            GA4 cookies are non-essential (analytics). We ask for your consent before setting them.
          </p>
        </Section>

        <Section title="4. Third-party cookies">
          <p>
            Google Analytics 4 may set first-party cookies under our domain, and Google may receive
            your IP address (anonymised before storage) and browser/device information. See{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noreferrer"
            >
              Google&rsquo;s Privacy Policy
            </a>{" "}
            for details.
          </p>
        </Section>

        <Section title="5. Managing your preferences">
          <p>You can withdraw or change your consent at any time by:</p>
          <ul>
            <li>
              Clearing <code>localStorage</code> in your browser&rsquo;s DevTools (Application →
              Local Storage), which resets your preference and shows the banner again;
            </li>
            <li>
              Blocking third-party cookies or all cookies in your browser settings;
            </li>
            <li>
              Using browser extensions such as uBlock Origin or Privacy Badger.
            </li>
          </ul>
        </Section>

        <Section title="6. Changes to this policy">
          <p>
            We may update this policy when we add or remove cookies. The date at the top of this
            page reflects the most recent revision.
          </p>
        </Section>

        <Section title="7. Contact">
          <p>
            Questions?{" "}
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
