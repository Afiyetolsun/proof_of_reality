import type { Metadata } from "next";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact — Proof of Reality",
  description: "Get in touch with the Proof of Reality team. Questions about integration, partnerships, or proofs.",
};

export default function ContactPage() {
  return (
    <>
      <Header />
      <main id="content" className="container-page py-24 md:py-32">
        <div className="grid grid-cols-1 gap-x-6 gap-y-16 md:grid-cols-12">

          {/* Left column — meta */}
          <div className="md:col-span-4">
            <div className="text-mono-s text-[--color-signal]">CONTACT</div>
            <h1 className="mt-4 text-display-l text-[--color-ink]">Get in touch.</h1>
            <p className="mt-6 text-body text-[--color-ink-mute] max-read">
              Questions about integration, partnership enquiries, or just want to talk
              proofs — reach out via the form or directly below.
            </p>

            <dl className="mt-12 divide-y divide-[--color-rule]">
              <ContactMeta label="EMAIL" href="mailto:support@realityproof.app" display="support@realityproof.app" />
              <ContactMeta label="TELEGRAM" href="https://t.me/ProofReality" display="t.me/ProofReality" external />
              <ContactMeta label="X / TWITTER" href="https://x.com/ProofReality" display="@ProofReality" external />
            </dl>
          </div>

          {/* Right column — form */}
          <div className="md:col-span-7 md:col-start-6">
            <div
              aria-hidden
              className="hidden md:block absolute left-1/2 top-0 h-full w-px bg-gradient-to-b from-transparent via-[--color-rule] to-transparent opacity-40 pointer-events-none"
            />
            <ContactForm />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function ContactMeta({
  label,
  href,
  display,
  external,
}: {
  label: string;
  href: string;
  display: string;
  external?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-4">
      <dt className="text-mono-s text-[--color-ink-mute]">{label}</dt>
      <dd>
        <a
          href={href}
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
          className="text-body-s text-[--color-ink] underline decoration-transparent underline-offset-4 transition-colors hover:decoration-[--color-signal] hover:text-[--color-signal]"
        >
          {display}
        </a>
      </dd>
    </div>
  );
}
