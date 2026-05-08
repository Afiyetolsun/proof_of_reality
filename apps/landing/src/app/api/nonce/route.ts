import { NextResponse } from "next/server";

export const runtime = "edge";
export const revalidate = 0;

const FALLBACK_NONCE = {
  nonce: "0a4c2ea21557418bbc1d57120142ad83e8fa6e030ad35125fe225b97929d2526",
  satSig: "",
  expiresAt: 0,
  src: "fallback",
  satPk: null,
  issuedAt: 0,
  provider: null,
  fresh: false,
};

export async function GET() {
  const apiUrl = process.env.PROOF_API_URL;
  if (!apiUrl) {
    return NextResponse.json(FALLBACK_NONCE, {
      headers: { "Cache-Control": "no-store" },
    });
  }
  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/nonce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) {
      return NextResponse.json(FALLBACK_NONCE, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    const body = (await res.json()) as Record<string, unknown>;
    return NextResponse.json(
      { ...body, fresh: true },
      { headers: { "Cache-Control": "public, max-age=8, s-maxage=8" } },
    );
  } catch {
    return NextResponse.json(FALLBACK_NONCE, {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
