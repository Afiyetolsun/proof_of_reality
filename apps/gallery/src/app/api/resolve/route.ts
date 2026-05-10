/**
 * GET /api/resolve?name=<ens-name>
 *
 * Resolve an ENS subname to a renderable scene URL. Same pipeline the
 * /<name> page uses (resolveEnsName + maybeConvertScene), exposed as a
 * tiny JSON endpoint so external surfaces (the landing page hero, etc.)
 * can embed a Reality NFT without re-implementing ENS resolution and
 * USDZ→GLB conversion.
 *
 * Returns a public absolute URL pointing back at /api/scene on this
 * deployment, so the caller doesn't have to learn anything about Bee /
 * Pinata / origin selection. CORS opened to * since the whole point is
 * cross-origin embedding.
 *
 * Cache: 60s SWR. Refs are immutable but ENS records can rotate, so we
 * do refresh — just slowly enough that this isn't an attack surface.
 */
import { NextResponse } from "next/server";
import { resolveEnsName, normalizeName, directContentUrl } from "@/lib/ens.js";
import { maybeConvertScene } from "@/lib/converter.js";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const rawName = searchParams.get("name")?.trim();

  if (!rawName) {
    return NextResponse.json(
      { error: "missing name" },
      { status: 400, headers: corsHeaders() },
    );
  }

  const name = normalizeName(decodeURIComponent(rawName));
  const res = await resolveEnsName(name);
  if (!res.ok) {
    const status = res.error.code === "NOT_FOUND" ? 404 : 502;
    return NextResponse.json(
      { error: res.error.code, message: res.error.message, name },
      { status, headers: corsHeaders() },
    );
  }

  const record = await maybeConvertScene(res.record);
  if (!record.content) {
    return NextResponse.json(
      { error: "NO_CONTENT", message: "subname has no contenthash", name },
      { status: 404, headers: corsHeaders() },
    );
  }

  const sceneUrl = `${origin}/api/scene?proto=${record.content.protocol}&ref=${encodeURIComponent(record.content.ref)}`;

  return NextResponse.json(
    {
      name,
      url: sceneUrl,
      directUrl: directContentUrl(record.content),
      protocol: record.content.protocol,
      ref: record.content.ref,
      mode: record.mode,
      attestor: record.attestor,
      tokenId: record.tokenId !== null ? record.tokenId.toString() : null,
    },
    { headers: corsHeaders({ "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=600" }) },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function corsHeaders(extra?: Record<string, string>): Headers {
  const h = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...(extra ?? {}),
  });
  return h;
}
