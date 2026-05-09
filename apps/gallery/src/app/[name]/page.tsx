/**
 * /<ens-name> — per-scan verification surface.
 *
 *   /penguin.realityproof.eth
 *   /penguin                              (auto-suffixes the parent)
 *
 * Resolves the ENS subname on Eth Sepolia, fetches the on-chain proof
 * struct on Base Sepolia by tokenId, fetches the canonical bundle from
 * Swarm, runs the witness verification chain, and renders the 3D scene
 * inline via <model-viewer>. USDZ contenthashes are rewritten to their
 * cached GLB equivalents by lib/converter.ts (server-side) before this
 * page renders.
 *
 * Layout intentionally mirrors apps/viewer/app/[name]/page.tsx — same
 * centered diamond + mono name hero, same single-column card stack —
 * so visitors get one consistent visual language whether they land on
 * the standalone viewer or the gallery's detail page. Gallery's wider
 * Header/Footer chrome is dropped here because it competes with the
 * focused proof view.
 *
 * Anyone with the URL can verify end-to-end — no app, no wallet.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveEnsName, contentUrl, directContentUrl, normalizeName } from "@/lib/ens.js";
import { maybeConvertScene } from "@/lib/converter.js";
import { getProof, ChainConfigMissingError } from "@/lib/chain/index.js";
import { runVerification } from "@/lib/verify/index.js";
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
    <main
      id="content"
      className="mx-auto flex max-w-[880px] flex-col gap-6 px-5 pb-20 pt-8"
    >
      <header className="px-2 pb-2 pt-6 text-center">
        <h1 className="m-0 break-all font-mono text-display-m text-[--color-ink]">
          {record.name}
        </h1>
        <p className="mx-auto mb-5 mt-3 max-w-[540px] text-body text-[--color-ink]">
          Cryptographic capture of physical reality. Verified by independent
          witnesses.
        </p>
        <ShareButton name={record.name} />
      </header>

      {sceneUrl && (
        <ProofScene
          url={sceneUrl}
          attestor={record.attestor ?? undefined}
          mode={record.mode ?? undefined}
        />
      )}

      <section className="rounded-[20px] border border-[--color-rule] bg-[--color-surface-raised] px-6 py-5">
        <h2 className="m-0 mb-3.5 text-eyebrow font-mono uppercase tracking-[0.08em] text-[--color-signal]">
          Verification
        </h2>
        {checks.length === 0 && record.tokenId === null && (
          <p className="text-body-s text-[--color-ink]">
            ENS records are still propagating (newly-minted proofs take ~25 s
            for the on-chain side to finalize). Refresh in a moment.
          </p>
        )}
        {checks.length === 0 && record.tokenId !== null && chainConfigMissing && (
          <p className="text-body-s text-[--color-ink]">
            On-chain witness verification is offline (deployment env vars
            unset). The ENS records below still prove the mint happened.
          </p>
        )}
        {checks.length === 0 && record.tokenId !== null && !chainConfigMissing && (
          <p className="text-body-s text-[--color-ink]">
            Couldn&apos;t fetch on-chain proof — see browser console.
          </p>
        )}
        {checks.length > 0 && <Badges checks={checks} />}
      </section>

      <section className="rounded-[20px] border border-[--color-rule] bg-[--color-surface-raised] px-6 py-5">
        <h2 className="m-0 mb-3.5 text-eyebrow font-mono uppercase tracking-[0.08em] text-[--color-signal]">
          Proof bundle
        </h2>
        <dl className="grid grid-cols-[minmax(120px,auto)_1fr] gap-x-5 gap-y-3 text-body-s">
          {record.tokenId !== null && (
            <KV label="Token">
              <span className="text-[--color-ink]">
                #{record.tokenId.toString()}
              </span>
              {record.url && (
                <>
                  {" "}
                  <a
                    href={record.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-mono-s text-[--color-signal] underline decoration-transparent underline-offset-4 hover:decoration-[--color-signal]"
                  >
                    Basescan ↗
                  </a>
                </>
              )}
            </KV>
          )}
          {record.bundleHash && (
            <KV label="Bundle hash">
              <span className="break-all font-mono text-mono-s text-[--color-ink]">
                {record.bundleHash}
              </span>
            </KV>
          )}
          {record.attestor && (
            <KV label="Attestor">
              <span className="break-all font-mono text-mono-s text-[--color-ink]">
                {record.attestor}
              </span>
            </KV>
          )}
          {record.cosmoSig && (
            <KV label="KMS co-signature">
              <span
                className="font-mono text-mono-s text-[--color-ink]"
                title={record.cosmoSig}
              >
                {shortHex(record.cosmoSig)}
              </span>
            </KV>
          )}
          {record.satSig && record.satSig !== "STUB" && (
            <KV label="Satellite signature">
              <span
                className="font-mono text-mono-s text-[--color-ink]"
                title={record.satSig}
              >
                {shortHex(record.satSig)}
              </span>
            </KV>
          )}
          {record.mode && (
            <KV label="Capture mode">
              <span className="text-[--color-ink]">{record.mode}</span>
            </KV>
          )}
          {record.capturedAt && (
            <KV label="Captured">
              <span className="text-[--color-ink]">{fmtDate(record.capturedAt)}</span>
            </KV>
          )}
          {record.content && (
            <KV label="Storage">
              <a
                href={directContentUrl(record.content)}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-mono-s text-[--color-ink] underline decoration-transparent underline-offset-4 hover:text-[--color-signal] hover:decoration-[--color-signal]"
              >
                {record.content.protocol}://{record.content.ref.slice(0, 14)}… ↗
              </a>
            </KV>
          )}
        </dl>
      </section>

      <footer className="mt-2 flex items-center justify-between border-t border-[--color-rule] pt-4 text-mono-s text-[--color-ink-mute]">
        <Link
          href="/"
          className="transition-colors hover:text-[--color-ink]"
        >
          ← Proof of Reality
        </Link>
        <a
          href={`${ensAppBase}/${record.name}`}
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-[--color-ink]"
        >
          View on ENS app ↗
        </a>
      </footer>
    </main>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="font-medium text-[--color-signal]">{label}</dt>
      <dd className="m-0 min-w-0 break-words text-[--color-ink]">{children}</dd>
    </>
  );
}

function shortHex(hex: string, head = 8, tail = 8): string {
  if (hex.length <= head + tail + 3) return hex;
  return `${hex.slice(0, head)}…${hex.slice(-tail)}`;
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
  const copy: Record<typeof kind, { icon: string; title: string; tagline: React.ReactNode; hint: string }> =
    {
      NOT_FOUND: {
        icon: "🔍",
        title: "No proof at this name",
        tagline: (
          <>
            Nothing minted under{" "}
            <span className="font-mono text-[--color-ink]">{name}</span> yet.
          </>
        ),
        hint: "Names look like vin-<12hex>.realityproof.eth or your-chosen-name.realityproof.eth",
      },
      NOT_OUR_RESOLVER: {
        icon: "🔗",
        title: "Wrong resolver",
        tagline: (
          <>
            <span className="font-mono text-[--color-ink]">{name}</span> exists in ENS
            but isn&apos;t pointed at our resolver, so it&apos;s not a Reality NFT.
          </>
        ),
        hint: "Reality NFT names use a custom resolver on Eth Sepolia.",
      },
      RPC_ERROR: {
        icon: "⚡",
        title: "RPC blip",
        tagline: <>Couldn&apos;t reach the Ethereum Sepolia node — try again in a moment.</>,
        hint: message,
      },
    };

  const c = copy[kind];

  return (
    <main className="mx-auto flex max-w-[880px] flex-col gap-6 px-5 pb-20 pt-16 text-center">
      <div className="text-[56px] leading-none">{c.icon}</div>
      <h1 className="m-0 text-display-m text-[--color-ink]">{c.title}</h1>
      <p className="mx-auto max-w-[52ch] text-body text-[--color-ink-mute]">{c.tagline}</p>
      <p className="text-mono-s text-[--color-ink-faint]">{c.hint}</p>
      <Link
        href="/"
        className="mx-auto mt-4 text-mono-s text-[--color-signal] underline decoration-transparent underline-offset-4 hover:decoration-[--color-signal]"
      >
        ← back to gallery
      </Link>
    </main>
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
