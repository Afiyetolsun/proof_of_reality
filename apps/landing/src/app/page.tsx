import { Header } from "../components/Header";
import { NonceTicker } from "../components/NonceTicker";
import { SplatHero } from "../components/SplatHero";
import { Section } from "../components/Section";
import { CTAButton } from "../components/CTAButton";
import { Mono } from "../components/Mono";
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
        <div className="text-mono-s text-[--color-signal]">
          ETHPRAGUE 2026 · SPACECOMPUTER TRACK
        </div>
        <h1 className="mt-6 text-display-xl text-[--color-ink]">
          Web3 oracle
          <br />
          for the <span className="text-[--color-signal]">physical world.</span>
        </h1>
        <p className="mt-8 max-w-[34rem] text-body text-[--color-ink-mute]">
          A 30-second scan, anchored to a satellite-borne random number, signed by a key that
          never leaves hardware, written to Base Sepolia. Five independent witnesses on every
          proof. Not generatable by AI, not pre-recordable, not forgeable on the ground.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <CTAButton href={viewerHome} external>
            Open the verifier
          </CTAButton>
          <CTAButton href={architectureUrl} variant="ghost" external>
            Architecture
          </CTAButton>
        </div>

        <dl className="mt-14 grid grid-cols-3 gap-6 border-t border-[--color-rule] pt-6">
          <Stat label="Witnesses" value="5" />
          <Stat label="Trust roots" value="public" />
          <Stat label="Backend can forge" value="zero" />
        </dl>
      </div>

      <div className="relative md:col-span-6">
        <div className="ml-auto w-full max-w-[42rem]">
          <SplatHero />
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
          We made one inedible.
        </>
      }
      intro="Marketplace listings drift toward fakes. RWA tokens claim assets that may not exist. Insurance disputes hinge on photographs that any laptop can generate in under a second. The web does not have a primitive for here, now, real."
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
    <section className="rule-top border-[--color-rule] py-20 md:py-28">
      <div className="container-page mb-12">
        <div className="grid grid-cols-12 gap-x-6">
          <div className="col-span-12 md:col-span-4">
            <div className="text-mono-s text-[--color-ink-mute]">02</div>
            <div className="mt-2 text-eyebrow font-mono text-[--color-ink-mute]">WITNESSES</div>
          </div>
          <div className="col-span-12 md:col-span-8">
            <h2 className="text-display-l text-[--color-ink]">
              Five independent witnesses
              <br />
              on every scan.
            </h2>
            <p className="mt-6 max-read text-body text-[--color-ink-mute]">
              No single party guarantees a proof. Five do, drawn from physics, hardware, and on-chain registries.
              Each one defends against a distinct class of attack. To forge a scan, you would have to break all
              five at once.
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
    </Section>
  );
}

function Demo() {
  return (
    <Section id="demo" eyebrow="LIVE DEMO" index="04" display="See it work in 90 seconds.">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
        <div className="md:col-span-7">
          <div className="aspect-video w-full border border-[--color-rule] bg-[--color-surface-raised]">
            <DemoVideo />
          </div>
        </div>
        <div className="md:col-span-5">
          <h3 className="text-h2 text-[--color-ink]">A real bundle on Base Sepolia.</h3>
          <p className="mt-4 max-read text-body-s text-[--color-ink-mute]">
            Or skip the video and verify a real, minted ProofBundle yourself. The viewer recomputes the bundle
            hash from Swarm, checks all five signatures, and either rejects or shows you a green page.
          </p>

          <dl className="mt-8 space-y-4 border-t border-[--color-rule] pt-4">
            <KV
              k="bundleHash"
              v="0xa7c4…b91f"
              caption="JCS-canonicalized, keccak-256"
            />
            <KV
              k="swarmRef"
              v="bah5acg…q7zu"
              caption="content-addressed via Bee BMT"
            />
            <KV
              k="tx"
              v="0x312f…8d04"
              caption="RealityProof.mint(...) on base-sepolia"
            />
          </dl>

          <div className="mt-8">
            <CTAButton href={viewerHome} external>
              Verify it yourself
            </CTAButton>
          </div>
        </div>
      </div>
    </Section>
  );
}

function DemoVideo() {
  return (
    <div className="relative h-full w-full">
      <video
        className="h-full w-full"
        controls
        preload="metadata"
        poster=""
        playsInline
        muted
      >
        <source src="/demo.mp4" type="video/mp4" />
      </video>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center text-mono-s text-[--color-ink-mute]"
      >
        DEMO · MP4 PENDING
      </div>
    </div>
  );
}

function KV({ k, v, caption }: { k: string; v: string; caption: string }) {
  return (
    <div className="border-b border-[--color-rule] pb-3">
      <dt className="text-mono-s text-[--color-ink-mute]">{k}</dt>
      <dd className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Mono className="text-[--color-signal]">{v}</Mono>
        <span className="text-mono-s text-[--color-ink-mute]">{caption}</span>
      </dd>
    </div>
  );
}

function BuiltOn() {
  const items = [
    ["SpaceComputer", "Orbitport · Space Fabric"],
    ["Swarm", "decentralized storage"],
    ["Base", "L2 settlement"],
    ["ENS", "subdomain resolution"],
    ["Apple", "Secure Enclave · App Attest"],
    ["Luxonis", "OAK 4 D camera"],
    ["USB Armory", "Mk II ECDSA signer"],
    ["TamaGo", "bare-metal Go firmware"],
  ] as const;
  return (
    <Section eyebrow="BUILT ON" index="05" display="No cobranding fictions.">
      <p className="max-read text-body text-[--color-ink-mute]">
        Every dependency below is a real one. We hold no hidden trust roots; if a system in this list breaks, the
        verifier says so.
      </p>
      <ul className="mt-12 grid grid-cols-2 gap-px bg-[--color-rule] md:grid-cols-4">
        {items.map(([name, sub]) => (
          <li
            key={name}
            className="flex flex-col justify-between bg-[--color-surface-deep] p-6 transition-colors hover:bg-[--color-surface-raised]"
            style={{ minHeight: 132 }}
          >
            <span className="text-mono-s text-[--color-ink-mute]">{sub.toUpperCase()}</span>
            <span className="mt-6 text-h2 text-[--color-ink]">{name}</span>
          </li>
        ))}
      </ul>
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
      <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
        {audiences.map((a) => (
          <article key={a.eyebrow} className="border-t border-[--color-signal] pt-5">
            <div className="text-mono-s text-[--color-signal]">{a.eyebrow}</div>
            <h3 className="mt-4 text-h2 text-[--color-ink]">{a.title}</h3>
            <p className="mt-4 max-read text-body-s text-[--color-ink-mute]">{a.copy}</p>
          </article>
        ))}
      </div>

      <div className="mt-20 grid grid-cols-1 gap-6 border-t border-[--color-rule] pt-10 md:grid-cols-12">
        <div className="md:col-span-4">
          <div className="text-eyebrow font-mono text-[--color-ink-mute]">RIGHT NOW</div>
        </div>
        <div className="md:col-span-8">
          <p className="text-display-m text-[--color-ink]">
            We are at ETHPrague. The verifier is open at{" "}
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
            <CTAButton href={viewerHome} external>
              Open the verifier
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
