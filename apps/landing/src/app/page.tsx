import { Header } from "../components/Header";
import { NonceTicker } from "../components/NonceTicker";
import { ProofHero } from "../components/ProofHero";
import { Section } from "../components/Section";
import { CTAButton } from "../components/CTAButton";
import { RealVsFake } from "../components/RealVsFake";
import { WitnessDiagram } from "../components/WitnessDiagram";
import { FlowDiagram } from "../components/FlowDiagram";
import { Footer } from "../components/Footer";
import { architectureUrl, viewerHome, githubUrl, ensAppParentUrl, ensParentName } from "../lib/viewer-link";

export default function Page() {
  return (
    <>
      <NonceTicker />
      <Header />
      <main id="content">
        <Hero />
        <TrustGap />
        <Witnesses />
        <Flow />
        <Demo />
        <BuiltOn />
        <BuildWithUs />
      </main>
      <Footer />
    </>
  );
}

function Hero() {
  return (
    <section className="container-page relative grid grid-cols-1 items-end gap-x-6 gap-y-16 pt-12 pb-28 md:grid-cols-12 md:pt-16 md:pb-32">
      <div className="md:col-span-6">
        <div className="text-mono-s text-[--color-signal]">ETHPRAGUE 2026</div>
        <h1 className="mt-6 text-display-xl text-[--color-ink]">
          Web3 oracle
          <br />
          for the <span className="text-[--color-signal]">physical world.</span>
        </h1>
        <p className="mt-8 max-w-[34rem] text-body text-[--color-ink-mute]">
          A 30-second scan, anchored to a satellite-signed nonce and signed by a key that never
          leaves hardware. Five witnesses on every proof. Not generatable by AI, not
          pre-recordable, not forgeable on the ground.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <CTAButton href={viewerHome} size="lg" external>
            Open the app
          </CTAButton>
          <CTAButton href={architectureUrl} variant="ghost" external>
            Architecture
          </CTAButton>
        </div>

        <dl className="mt-14 grid grid-cols-2 gap-6 border-t border-[--color-rule] pt-6">
          <Stat label="Witnesses" value="5" />
          <Stat label="Trust roots" value="public" />
        </dl>
      </div>

      <div className="relative md:col-span-6">
        <div className="ml-auto w-full max-w-[42rem]">
          <ProofHero name={process.env.NEXT_PUBLIC_HERO_ENS_NAME ?? "pizza.realityproof.eth"} />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-mono-s text-[--color-ink-mute]">{label.toUpperCase()}</dt>
      <dd className="mt-1 text-display-m text-[--color-ink]">{value}</dd>
    </div>
  );
}

function TrustGap() {
  return (
    <Section
      id="trust"
      eyebrow="THE TRUST GAP"
      index="01"
      display={
        <>
          AI made every photograph editable.
          <br />
          We made one it can&rsquo;t.
        </>
      }
      intro="Marketplace listings drift toward fakes. RWA tokens claim assets that may not exist. Insurance disputes hinge on photographs that any laptop can generate in under a second. The web has no primitive for here, now, real."
    >
      <figure className="my-12 max-w-3xl">
        <blockquote className="font-serif italic text-[--color-ink]" style={{ fontSize: "clamp(1.5rem, 2.5vw, 2.25rem)", lineHeight: 1.3 }}>
          “Ground can be tampered with. Space cannot.”
        </blockquote>
        <figcaption className="mt-3 text-mono-s text-[--color-ink-mute]">
          — SpaceComputer, on the orbital trust root.
        </figcaption>
      </figure>

      <RealVsFake />
    </Section>
  );
}

function Witnesses() {
  return (
    <section className="relative py-24 md:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px container-page"
      >
        <div className="h-full w-full bg-gradient-to-r from-transparent via-[--color-rule] to-transparent opacity-60" />
      </div>
      <div className="container-page mb-16">
        <div className="grid grid-cols-12 gap-x-6">
          <div className="col-span-12 md:col-span-4">
            <div className="text-mono-s text-[--color-ink-mute]">02</div>
            <div className="mt-2 text-eyebrow font-mono text-[--color-ink-mute]">WITNESSES</div>
          </div>
          <div className="col-span-12 md:col-span-8">
            <h2 className="text-display-l text-[--color-ink]">
              Five witnesses
              <br />
              on every scan.
            </h2>
            <p className="mt-6 max-read text-body text-[--color-ink-mute]">
              No single party guarantees a proof. Five do, drawn from physics, hardware, and on-chain
              registries.
            </p>
          </div>
        </div>
      </div>
      <WitnessDiagram />
    </section>
  );
}

function Flow() {
  return (
    <Section
      id="flow"
      eyebrow="THE FLOW"
      index="03"
      display={
        <>
          Two capture frontends.
          <br />
          One trust pipeline.
        </>
      }
      intro="An iPhone scanning a watch in a New York apartment and an OAK 4 D camera scanning a vehicle in a Prague garage produce the same proof shape, hit the same backend, and mint to the same contract."
    >
      <FlowDiagram />
      <HardwareSpotlight />
    </Section>
  );
}

function HardwareSpotlight() {
  const specs = [
    ["IP67", "dust + jet-water rated"],
    ["Aluminum body", "passively cooled, field-grade"],
    ["Stereo depth + RGB + IMU", "metric capture, no markers"],
    ["On-board NPU", "depth + tracking on-device"],
  ] as const;

  return (
    <div className="mt-20 grid grid-cols-1 gap-x-6 gap-y-10 md:mt-24 md:grid-cols-12">
      <div className="md:col-span-7">
        {/* Animated WebP with per-frame alpha. Plain <img> rather than next/image
            so the animation isn't transcoded to a static frame. */}
        <img
          src="/hardware/oak4d.webp"
          alt="Luxonis OAK 4 D, four-lens stereo + RGB camera module, slowly rotating"
          width={1100}
          height={600}
          loading="lazy"
          decoding="async"
          className="h-auto w-full select-none"
        />
      </div>

      <div className="md:col-span-5 md:pl-2">
        <div className="text-mono-s text-[--color-signal]">OAK 4 D · LUXONIS</div>
        <h3 className="mt-4 text-h2 text-[--color-ink]">Industrial-grade capture.</h3>
        <p className="mt-5 max-read text-body text-[--color-ink-mute]">
          The body that feeds our B2B signing path. IP67-rated, machined aluminum, no
          moving parts, four cameras and an IMU on a single USB-C tether or PoE+ run.
        </p>

        <dl className="mt-8 divide-y divide-[--color-rule]">
          {specs.map(([k, v]) => (
            <div
              key={k}
              className="flex items-baseline justify-between gap-4 py-3 text-body-s"
            >
              <dt className="text-[--color-ink]">{k}</dt>
              <dd className="text-right text-mono-s text-[--color-ink-mute]">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function Demo() {
  const steps = [
    ["Pick any mint", "the gallery lists every Reality NFT under realityproof.eth"],
    ["Recompute the hash", "JCS-canonicalize the bundle, keccak it, match against on-chain"],
    ["Check the five signatures", "satellite, KMS, device, Swarm CAC, App Attest"],
    ["Accept or reject", "no third party in the loop"],
  ] as const;

  return (
    <Section id="demo" eyebrow="VERIFY ONE" index="04" display="Open a real proof.">
      <div className="grid grid-cols-1 items-start gap-12 md:grid-cols-12 md:gap-x-10">
        <div className="md:col-span-5">
          <DemoVideo />
        </div>

        <div className="md:col-span-7 md:pl-2">
          <p className="max-read text-body text-[--color-ink-mute]">
            The app re-fetches the bundle from Swarm, recomputes the hash, and checks all five
            witnesses against their public keys. It either accepts or it doesn&rsquo;t.
          </p>

          <ol className="mt-10 space-y-5">
            {steps.map(([title, detail], i) => (
              <li
                key={title}
                className="grid grid-cols-[auto_1fr] items-baseline gap-x-5 gap-y-1"
              >
                <span className="text-mono-s text-[--color-signal]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-h2 text-[--color-ink]" style={{ fontSize: "1.5rem" }}>
                  {title}
                </h3>
                <span aria-hidden />
                <p className="max-read text-body-s text-[--color-ink-mute]">{detail}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <CTAButton href={viewerHome} size="lg" external>
              Open the app
            </CTAButton>
            <CTAButton href={ensAppParentUrl} variant="ghost" external>
              Browse on ENS
            </CTAButton>
          </div>
        </div>
      </div>
    </Section>
  );
}

function DemoVideo() {
  return (
    <figure className="relative mx-auto w-full max-w-[22rem] overflow-hidden border border-[--color-rule] bg-[--color-surface-raised]">
      <div className="aspect-[9/16] w-full">
        <video
          className="h-full w-full object-cover"
          src="/promo.webm"
          autoPlay
          muted
          loop
          controls
          playsInline
          preload="metadata"
          poster="/og-image.png"
        />
      </div>
      <figcaption className="pointer-events-none absolute left-3 top-3 text-mono-s text-[--color-ink-mute]">
        PROMO · 90 SEC
      </figcaption>
    </figure>
  );
}

function BuiltOn() {
  const groups = [
    {
      eyebrow: "TRUST ROOTS",
      items: [
        ["SpaceComputer", "Orbitport cTRNG · Space Fabric KMS"],
        ["Apple", "Secure Enclave · App Attest"],
        ["USB Armory", "Mk II ECDSA in DCP + OTPMK"],
      ],
    },
    {
      eyebrow: "SETTLEMENT",
      items: [
        ["Base", "Sepolia L2"],
        ["ENS", "realityproof.eth subnames"],
      ],
    },
    {
      eyebrow: "STORAGE & FIRMWARE",
      items: [
        ["Swarm", "Bee + BMT content addressing"],
        ["Luxonis", "OAK 4 D camera"],
        ["TamaGo", "bare-metal Go firmware"],
      ],
    },
  ] as const;

  return (
    <Section eyebrow="BUILT ON" index="05" display="No cobranding fictions.">
      <p className="max-read text-body text-[--color-ink-mute]">
        Every dependency is a real one. If any of them breaks, the app says so.
      </p>
      <div className="mt-14 grid grid-cols-1 gap-x-6 gap-y-12 md:grid-cols-12">
        {groups.map((g) => (
          <section key={g.eyebrow} className="md:col-span-4">
            <div className="text-eyebrow font-mono text-[--color-signal]">{g.eyebrow}</div>
            <ul className="mt-5 divide-y divide-[--color-rule]">
              {g.items.map(([name, sub]) => (
                <li key={name} className="flex items-baseline justify-between gap-4 py-3">
                  <span className="text-h2 text-[--color-ink]" style={{ fontSize: "1.375rem" }}>
                    {name}
                  </span>
                  <span className="text-right text-mono-s text-[--color-ink-mute]">{sub}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Section>
  );
}

function BuildWithUs() {
  const audiences = [
    {
      eyebrow: "MARKETPLACES",
      title: "Verified listings as a primitive.",
      copy: "Every listing carries a Reality NFT. The lemons sort themselves out.",
    },
    {
      eyebrow: "RWA · DEFI",
      title: "Tokens that prove their underlying.",
      copy: "Mint against a verifiable 3D snapshot, not a PDF and a promise.",
    },
    {
      eyebrow: "DEPIN · ORACLES",
      title: "An oracle for the physical world.",
      copy: "Smart contracts that need to know an object exists can ask, and trust the answer.",
    },
  ];
  return (
    <Section eyebrow="BUILD WITH US" index="06" display="A primitive, not a product.">
      <ul className="divide-y divide-[--color-rule]">
        {audiences.map((a) => (
          <li
            key={a.eyebrow}
            className="grid grid-cols-1 gap-x-6 gap-y-3 py-8 md:grid-cols-12"
          >
            <div className="md:col-span-3">
              <span className="text-mono-s text-[--color-signal]">{a.eyebrow}</span>
            </div>
            <h3 className="text-h2 text-[--color-ink] md:col-span-5">{a.title}</h3>
            <p className="max-read text-body-s text-[--color-ink-mute] md:col-span-4">{a.copy}</p>
          </li>
        ))}
      </ul>

      <div className="mt-20 grid grid-cols-1 gap-6 border-t border-[--color-rule] pt-10 md:grid-cols-12">
        <div className="md:col-span-4">
          <div className="text-eyebrow font-mono text-[--color-ink-mute]">RIGHT NOW</div>
        </div>
        <div className="md:col-span-8">
          <p className="text-display-m text-[--color-ink]">
            We are at ETHPrague. The app is open at{" "}
            <a
              href={viewerHome}
              target="_blank"
              rel="noreferrer"
              className="text-[--color-signal] underline decoration-[--color-signal] underline-offset-4 hover:decoration-2"
            >
              app.realityproof.app
            </a>
            . Every mint resolves under{" "}
            <a
              href={ensAppParentUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[--color-signal] underline decoration-[--color-signal] underline-offset-4 hover:decoration-2"
            >
              {ensParentName}
            </a>
            . Open the proof.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
            <CTAButton href={viewerHome} size="lg" external>
              Open the app
            </CTAButton>
            <CTAButton href={githubUrl} variant="ghost" external>
              Read the source
            </CTAButton>
          </div>
        </div>
      </div>
    </Section>
  );
}
