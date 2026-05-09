/**
 * /<ens-name> — per-scan verification surface.
 *
 *   /penguin.realityproof.eth
 *   /penguin                              (auto-suffixes the parent)
 *
 * Resolves the ENS subname on Eth Sepolia, fetches the on-chain proof
 * struct on Base Sepolia by tokenId, fetches the canonical bundle from
 * Swarm, runs the five-witness verification chain, and renders the 3D
 * scene inline via <model-viewer>. USDZ contenthashes are rewritten
 * to their cached GLB equivalents by lib/converter.ts (server-side)
 * before this page renders.
 *
 * Anyone with the URL can verify end-to-end — no app, no wallet.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveEnsName, contentUrl, directContentUrl, normalizeName } from "@/lib/ens.js";
import { maybeConvertScene } from "@/lib/converter.js";
import { getProof, ChainConfigMissingError } from "@/lib/chain/index.js";
import { runVerification } from "@/lib/verify/index.js";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Mono, shortHex, shortAddress } from "@/components/Mono";
import { Eyebrow } from "@/components/Eyebrow";
import { ProofScene } from "./ProofScene";
import { Badges } from "./Badges";
import { ShareButton } from "./ShareButton";
import { fmtDate } from "./fmt";

interface PageProps {
  params: Promise<{ name: string }>;
}

export default async function NamePage({ params }: PageProps) {
  const { name: rawName } = await params;
  const name = normalizeName(decodeURIComponent(rawName));

  const res = await resolveEnsName(name);
  if (!res.ok) {
    if (res.error.code === "NOT_FOUND") notFound();
    return <ErrorView kind={res.error.code} message={res.error.message} name={name} />;
  }

  // If the contenthash is a USDZ on Swarm, ask the converter for the
  // GLB version (cached per ref on the VPS) so <model-viewer> can
  // render it in-canvas. Silent no-op when the converter is offline,
  // the scene is already GLB, or the format can't be detected.
  const record = await maybeConvertScene(res.record);

  let onchain: Awaited<ReturnType<typeof getProof>> | null = null;
  let checks: Awaited<ReturnType<typeof runVerification>> = [];
  let chainConfigMissing = false;
  if (record.tokenId !== null) {
    try {
      onchain = await getProof(record.tokenId);
      checks = await runVerification(onchain);
    } catch (e) {
      if (e instanceof ChainConfigMissingError) {
        chainConfigMissing = true;
      } else {
        console.warn("[gallery] on-chain fetch failed:", (e as Error).message);
      }
    }
  }
  void onchain;

  const sceneUrl = record.content ? contentUrl(record.content) : null;
  const ensAppBase =
    process.env.NEXT_PUBLIC_ENS_APP_BASE_URL ?? "https://sepolia.app.ens.domains";

  return (
    <>
      <Header />
      <main id="content" className="container-page pb-12 pt-6 md:pt-10">
        <Link
          href="/"
          className="text-mono-s text-[--color-ink-mute] underline decoration-transparent underline-offset-4 transition-colors hover:text-[--color-ink] hover:decoration-[--color-signal]"
        >
          ← all scans
        </Link>

        <header className="mt-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <Eyebrow signal>Reality NFT</Eyebrow>
            <h1 className="mt-3 break-all text-display-m font-mono text-[--color-ink]">
              {record.name}
            </h1>
            <p className="mt-3 max-w-[60ch] text-body text-[--color-ink-mute]">
              Cryptographic capture of physical reality. Verified by independent witnesses;
              click each row below to read what it checks.
            </p>
          </div>
          <ShareButton name={record.name} />
        </header>

        {sceneUrl && (
          <section className="mt-10">
            <ProofScene
              url={sceneUrl}
              attestor={record.attestor ?? undefined}
              mode={record.mode ?? undefined}
            />
          </section>
        )}

        <section className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Eyebrow>Verification</Eyebrow>
            <h2 className="mt-3 text-h2 text-[--color-ink]">Witnesses</h2>
            <div className="mt-5">
              {checks.length === 0 && record.tokenId === null && (
                <p className="text-body-s text-[--color-ink-mute]">
                  ENS records are still propagating (newly-minted proofs take ~25s for the
                  on-chain side to finalize). Refresh in a moment.
                </p>
              )}
              {checks.length === 0 && record.tokenId !== null && chainConfigMissing && (
                <p className="text-body-s text-[--color-ink-mute]">
                  On-chain witness verification is offline (deployment env vars unset). The
                  ENS records below still prove the mint happened.
                </p>
              )}
              {checks.length === 0 && record.tokenId !== null && !chainConfigMissing && (
                <p className="text-body-s text-[--color-ink-mute]">
                  Couldn&apos;t fetch on-chain proof — see browser console.
                </p>
              )}
              {checks.length > 0 && <Badges checks={checks} />}
            </div>
          </div>

          <div className="lg:col-span-5">
            <Eyebrow>Proof bundle</Eyebrow>
            <h2 className="mt-3 text-h2 text-[--color-ink]">Records</h2>
            <dl className="mt-5 grid grid-cols-[max-content_1fr] gap-x-5 gap-y-3 text-body-s">
              {record.tokenId !== null && (
                <KV label="token">
                  <span className="text-[--color-ink]">#{record.tokenId.toString()}</span>
                  {record.url && (
                    <>
                      {"  "}
                      <a
                        href={record.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-mono-s text-[--color-signal] underline decoration-transparent underline-offset-4 hover:decoration-[--color-signal]"
                      >
                        basescan ↗
                      </a>
                    </>
                  )}
                </KV>
              )}
              {record.bundleHash && (
                <KV label="bundle">
                  <Mono className="text-mono-s break-all" title={record.bundleHash}>
                    {record.bundleHash}
                  </Mono>
                </KV>
              )}
              {record.attestor && (
                <KV label="attestor">
                  <Mono className="text-mono-s" title={record.attestor}>
                    {shortAddress(record.attestor)}
                  </Mono>
                </KV>
              )}
              {record.cosmoSig && (
                <KV label="kms cosig">
                  <Mono className="text-mono-s" title={record.cosmoSig}>
                    {shortHex(record.cosmoSig)}
                  </Mono>
                </KV>
              )}
              {record.satSig && record.satSig !== "STUB" && (
                <KV label="satellite">
                  <Mono className="text-mono-s" title={record.satSig}>
                    {shortHex(record.satSig)}
                  </Mono>
                </KV>
              )}
              {record.mode && <KV label="mode">{record.mode}</KV>}
              {record.capturedAt && <KV label="captured">{fmtDate(record.capturedAt)}</KV>}
              {record.content && (
                <KV label="storage">
                  <a
                    href={directContentUrl(record.content)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-mono-s text-[--color-ink] underline decoration-transparent underline-offset-4 hover:text-[--color-signal] hover:decoration-[--color-signal]"
                  >
                    {record.content.protocol}://{record.content.ref.slice(0, 14)}… ↗
                  </a>
                </KV>
              )}
            </dl>

            <div className="mt-6 border-t border-[--color-rule] pt-4">
              <a
                href={`${ensAppBase}/${record.name}`}
                target="_blank"
                rel="noreferrer"
                className="text-mono-s text-[--color-ink-mute] underline decoration-transparent underline-offset-4 hover:text-[--color-ink] hover:decoration-[--color-signal]"
              >
                view on ens app ↗
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-mono-xs text-[--color-ink-faint]">{label}</dt>
      <dd className="min-w-0 text-[--color-ink]">{children}</dd>
    </>
  );
}

function ErrorView({
  kind,
  message,
  name,
}: {
  kind: "NOT_OUR_RESOLVER" | "RPC_ERROR" | "NOT_FOUND";
  message: string;
  name: string;
}) {
  const copy: Record<typeof kind, { title: string; tagline: React.ReactNode; hint: string }> =
    {
      NOT_FOUND: {
        title: "No proof at this name",
        tagline: (
          <>
            Nothing minted under{" "}
            <span className="text-mono text-[--color-ink]">{name}</span> yet.
          </>
        ),
        hint: "Names look like vin-<12hex>.realityproof.eth or your-chosen-name.realityproof.eth",
      },
      NOT_OUR_RESOLVER: {
        title: "Wrong resolver",
        tagline: (
          <>
            <span className="text-mono text-[--color-ink]">{name}</span> exists in ENS but
            isn&apos;t pointed at our resolver, so it&apos;s not a Reality NFT.
          </>
        ),
        hint: "Reality NFT names use a custom resolver on Eth Sepolia.",
      },
      RPC_ERROR: {
        title: "RPC blip",
        tagline: <>Couldn&apos;t reach the Ethereum Sepolia node — try again in a moment.</>,
        hint: message,
      },
    };

  const c = copy[kind];

  return (
    <>
      <Header />
      <main id="content" className="container-page pb-20 pt-16">
        <Eyebrow>Error</Eyebrow>
        <h1 className="mt-3 text-display-m text-[--color-ink]">{c.title}</h1>
        <p className="mt-4 text-body text-[--color-ink-mute]">{c.tagline}</p>
        <p className="mt-2 text-mono-s text-[--color-ink-faint]">{c.hint}</p>
        <Link
          href="/"
          className="mt-8 inline-block text-mono-s text-[--color-signal] underline decoration-transparent underline-offset-4 hover:decoration-[--color-signal]"
        >
          ← back to gallery
        </Link>
      </main>
      <Footer />
    </>
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
