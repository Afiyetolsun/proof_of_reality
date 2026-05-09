/**
 * /<ens-name> — primary public verification surface.
 *
 *   /vin-2c3f5b615ab6.realityproof.eth
 *   /vin-2c3f5b615ab6                    (auto-suffixes the parent)
 *   /my-apartment.realityproof.eth       (user-chosen labels, once iOS supports them)
 *
 * What this page does:
 *   1. Resolve the ENS name via our custom resolver (Eth Sepolia)
 *   2. Read the on-chain proof from RealityProof (Base Sepolia) by tokenId
 *   3. Fetch the canonical bundle from Swarm
 *   4. Render the scene with <model-viewer>
 *   5. Show four signature witnesses with green checks
 *   6. Big Share button
 *
 * Designed so anyone with the URL — no app, no wallet, no metamask —
 * can independently verify the proof end-to-end.
 */
import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";
import { resolveEnsName, contentUrl, directContentUrl, normalizeName } from "@/lib/ens";
import { getProof } from "@/lib/chain";
import { runVerification } from "@/lib/verify";
import { ShareButton } from "./ShareButton";
import { ProofScene } from "./ProofScene";
import { Badges } from "./Badges";
import { fmtDate, shortHex } from "./fmt";

interface PageProps {
  params: Promise<{ name: string }>;
}

export default async function NamePage({ params }: PageProps) {
  const { name: rawName } = await params;
  const name = normalizeName(decodeURIComponent(rawName));

  const res = await resolveEnsName(name);
  if (!res.ok) {
    if (res.error.code === "NOT_FOUND") notFound();
    return (
      <ErrorView
        title="Couldn't resolve this name"
        message={res.error.message}
        name={name}
      />
    );
  }

  const record = res.record;

  // On-chain proof — only fetch if we have a tokenId. Some records may
  // be partially populated during the ~25s window between mint and
  // the second ENS publication tx landing.
  let onchain: Awaited<ReturnType<typeof getProof>> | null = null;
  let checks: Awaited<ReturnType<typeof runVerification>> = [];
  if (record.tokenId !== null) {
    try {
      onchain = await getProof(record.tokenId);
      checks = await runVerification(onchain);
    } catch (e) {
      // Don't fail the page — just show what we have from ENS.
      console.warn("[viewer] on-chain fetch failed:", (e as Error).message);
    }
  }

  const sceneUrl = record.content ? contentUrl(record.content) : null;
  const sceneIsModel =
    sceneUrl !== null &&
    /\.(glb|gltf|usdz)$|\?.*=.*\.(glb|gltf|usdz)/i.test(sceneUrl) === false;
  // model-viewer can render anything served as model/gltf-binary or
  // model/vnd.usdz+zip — the URL extension is a hint but we trust the
  // server's Content-Type. Default to "yes, try to render".

  return (
    <>
      <Script
        type="module"
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js"
        strategy="beforeInteractive"
      />
      <main className="page">
        <header className="hero">
          <div className="hero-name">
            <span className="hero-icon">◆</span>
            <h1>{record.name}</h1>
          </div>
          <p className="hero-tag">
            Cryptographic capture of physical reality. Verified by four independent
            witnesses.
          </p>
          <ShareButton name={record.name} />
        </header>

        {sceneUrl && (
          <ProofScene url={sceneUrl} attestor={record.attestor ?? undefined} />
        )}

        <section className="card">
          <h2>Verification</h2>
          {checks.length === 0 && record.tokenId === null && (
            <p className="muted">
              ENS records are still propagating (newly-minted proofs take ~25 s for
              the on-chain side to finalize). Refresh in a moment.
            </p>
          )}
          {checks.length === 0 && record.tokenId !== null && (
            <p className="muted">Couldn't fetch on-chain proof — see browser console.</p>
          )}
          {checks.length > 0 && <Badges checks={checks} />}
        </section>

        <section className="card">
          <h2>Proof bundle</h2>
          <dl className="kv">
            {record.tokenId !== null && (
              <>
                <dt>Token</dt>
                <dd>
                  #{record.tokenId.toString()}{" "}
                  {record.url && (
                    <a href={record.url} target="_blank" rel="noreferrer">
                      Basescan ↗
                    </a>
                  )}
                </dd>
              </>
            )}
            {record.bundleHash && (
              <>
                <dt>Bundle hash</dt>
                <dd className="mono">{record.bundleHash}</dd>
              </>
            )}
            {record.attestor && (
              <>
                <dt>Attestor</dt>
                <dd className="mono">{record.attestor}</dd>
              </>
            )}
            {record.cosmoSig && (
              <>
                <dt>KMS co-signature</dt>
                <dd className="mono">{shortHex(record.cosmoSig)}</dd>
              </>
            )}
            {record.satSig && record.satSig !== "STUB" && (
              <>
                <dt>Satellite signature</dt>
                <dd className="mono">{shortHex(record.satSig)}</dd>
              </>
            )}
            {record.mode && (
              <>
                <dt>Capture mode</dt>
                <dd>{record.mode}</dd>
              </>
            )}
            {record.capturedAt && (
              <>
                <dt>Captured</dt>
                <dd>{fmtDate(record.capturedAt)}</dd>
              </>
            )}
            {record.content && (
              <>
                <dt>Storage</dt>
                <dd>
                  <a href={directContentUrl(record.content)} target="_blank" rel="noreferrer">
                    {record.content.protocol}://{record.content.ref.slice(0, 14)}… ↗
                  </a>
                </dd>
              </>
            )}
          </dl>
        </section>

        <footer className="footer">
          <Link href="/">← Proof of Reality</Link>
          <a
            href={`https://sepolia.app.ens.domains/${record.name}`}
            target="_blank"
            rel="noreferrer"
          >
            View on ENS app ↗
          </a>
        </footer>
      </main>
    </>
  );
}

function ErrorView({
  title,
  message,
  name,
}: {
  title: string;
  message: string;
  name: string;
}) {
  return (
    <main className="page">
      <header className="hero">
        <h1>{title}</h1>
        <p className="hero-tag mono">{name}</p>
        <p className="muted">{message}</p>
      </header>
      <footer className="footer">
        <Link href="/">← Proof of Reality</Link>
      </footer>
    </main>
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
