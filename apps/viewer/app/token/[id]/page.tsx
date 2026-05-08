import { runVerification, type VerificationCheck } from "@/lib/verify";
import { getProof } from "@/lib/chain";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TokenPage({ params }: PageProps) {
  const { id } = await params;
  const tokenId = BigInt(id);

  let proof;
  try {
    proof = await getProof(tokenId);
  } catch (e) {
    return (
      <main style={{ padding: 32 }}>
        <h1>Token #{id}</h1>
        <p style={{ color: "crimson" }}>Failed to load proof: {(e as Error).message}</p>
      </main>
    );
  }

  const checks = await runVerification(proof);

  return (
    <main style={{ padding: 32, maxWidth: 720 }}>
      <h1>Token #{id}</h1>
      <p>
        <a href={`https://sepolia.basescan.org/token/${process.env.NEXT_PUBLIC_REALITY_PROOF_ADDRESS}?a=${id}`}>
          View on Basescan ↗
        </a>
      </p>
      <h2>Verification</h2>
      <ul>
        {checks.map((c: VerificationCheck) => (
          <li key={c.name} style={{ color: c.ok ? "green" : "crimson" }}>
            {c.ok ? "✅" : "❌"} <b>{c.name}</b> — {c.detail}
          </li>
        ))}
      </ul>
      <h2>Proof</h2>
      <pre style={{ fontSize: 12, overflow: "auto" }}>
        {JSON.stringify(
          proof,
          (_, v) => (typeof v === "bigint" ? v.toString() : v),
          2,
        )}
      </pre>
    </main>
  );
}
