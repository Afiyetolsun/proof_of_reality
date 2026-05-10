/**
 * GET /api/preview?proto=bzz&ref=<bzz-hex>
 *
 * Returns `{ glbRef: <hex> | null }` for a Swarm contenthash:
 *
 *   - If the upstream content-type is already GLB → returns the same ref.
 *   - If it's USDZ AND the converter has a cached conversion → returns
 *     the cached GLB ref.
 *   - If conversion would have to run from scratch (cold cache, ~5–15 s)
 *     OR the converter is unreachable OR the format is anything else →
 *     returns `{ glbRef: null }`.
 *
 * Used by the gallery card grid to decide whether to auto-mount a
 * spinning <model-viewer> preview. The 3 s timeout below keeps the
 * grid responsive: cold-cache scans surface as static pictograms, hot
 * ones get the live preview.
 *
 * Server-side route so the converter URL stays out of the browser
 * (also avoids mixed-content blocking when the converter is plain
 * HTTP and the page is HTTPS).
 */
import { NextResponse } from "next/server";

const HEX64 = /^[0-9a-fA-F]{64}$/;
const CONVERTER_URL = process.env.NEXT_PUBLIC_CONVERTER_URL?.replace(/\/$/, "");
const BEE_URL = (
  process.env.NEXT_PUBLIC_BEE_LOCAL ??
  process.env.NEXT_PUBLIC_SWARM_GATEWAY ??
  "https://api.gateway.ethswarm.org"
).replace(/\/$/, "");

const GLB_HINTS = ["gltf-binary", "model/gltf"];

// Hard cap on how long we'll wait for the converter to answer. 3 s
// covers cache hits (~50 ms) comfortably while letting cold-cache
// requests fall through to the pictogram fallback fast.
const CONVERTER_TIMEOUT_MS = 3000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ref = searchParams.get("ref")?.trim().toLowerCase() ?? "";
  const proto = searchParams.get("proto");

  if (proto !== "bzz") {
    return NextResponse.json({ glbRef: null });
  }
  if (!HEX64.test(ref)) {
    return NextResponse.json({ glbRef: null });
  }

  // 1. Probe upstream. GLB content-type → reuse the same ref.
  let ct = "";
  try {
    const head = await fetch(`${BEE_URL}/bzz/${ref}`, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
    });
    if (head.ok) ct = (head.headers.get("content-type") ?? "").toLowerCase();
  } catch {
    /* fall through to converter */
  }
  if (GLB_HINTS.some((h) => ct.includes(h))) {
    return NextResponse.json({ glbRef: ref });
  }

  // 2. Anything else → ask the converter, with a hard timeout. The
  //    converter answers in ~50 ms for cached refs; if it doesn't
  //    respond inside CONVERTER_TIMEOUT_MS we treat it as "no preview
  //    yet" and the card stays as a pictogram.
  if (!CONVERTER_URL) {
    return NextResponse.json({ glbRef: null });
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), CONVERTER_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${CONVERTER_URL}/convert?ref=${ref}&proto=bzz`,
      { cache: "no-store", signal: ac.signal },
    );
    if (!res.ok) return NextResponse.json({ glbRef: null });
    const text = await res.text();
    let json: { glbRef?: string };
    try {
      json = JSON.parse(text) as { glbRef?: string };
    } catch {
      return NextResponse.json({ glbRef: null });
    }
    return NextResponse.json({ glbRef: json.glbRef ?? null });
  } catch {
    return NextResponse.json({ glbRef: null });
  } finally {
    clearTimeout(timer);
  }
}
