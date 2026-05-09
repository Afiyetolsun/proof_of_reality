/**
 * /token/[id] — fallback route for direct-by-tokenId access.
 *
 * Reads the proof on-chain to derive the bundleHash → predicts the
 * deterministic ENS subname → 308-redirects to /<ens-name>. This way
 * token-ID URLs (e.g. from older Basescan deep-links) still land on
 * the polished ENS page.
 *
 * If the on-chain read fails we render an inline error rather than
 * 404, so the user gets actionable feedback.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getProof } from "@/lib/chain";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TokenPage({ params }: PageProps) {
  const { id } = await params;

  let proof: { bundleHash?: string } | null = null;
  try {
    const tokenId = BigInt(id);
    proof = (await getProof(tokenId)) as { bundleHash?: string };
  } catch (e) {
    return (
      <main className="page">
        <section className="landing-hero">
          <h1>Token #{id}</h1>
          <p className="muted">Couldn&apos;t load proof: {(e as Error).message}</p>
          <Link href="/">← Back home</Link>
        </section>
      </main>
    );
  }

  const bundleHash = proof?.bundleHash?.toLowerCase();
  if (!bundleHash || !/^0x[0-9a-f]{64}$/.test(bundleHash)) {
    return (
      <main className="page">
        <section className="landing-hero">
          <h1>Token #{id}</h1>
          <p className="muted">No bundleHash on-chain for this token.</p>
          <Link href="/">← Back home</Link>
        </section>
      </main>
    );
  }

  // Predict the deterministic ENS name and redirect there. If the user
  // chose a custom label at mint time the predicted name still resolves
  // (the resolver is keyed on the namehash, and our backend's default
  // is the canonical fallback when no label was supplied).
  const slug = bundleHash.replace(/^0x/, "").slice(0, 12);
  const parent = process.env.NEXT_PUBLIC_ENS_PARENT_NAME ?? "realityproof.eth";
  const ensName = `vin-${slug}.${parent}`;
  redirect(`/${ensName}`);
}

export const dynamic = "force-dynamic";
