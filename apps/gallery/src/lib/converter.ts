/**
 * Server-side USDZ → GLB conversion lookup.
 *
 * Given an ENS contenthash that resolves to a USDZ on Swarm, ask the
 * converter service (infra/converter/, runs alongside Bee on the VPS)
 * for the GLB version. Returns a new EnsRecord whose content ref has
 * been swapped for the GLB ref if conversion succeeded — otherwise the
 * record unchanged so the page renders the QuickLook fallback.
 *
 * Mirrors apps/viewer/lib/converter.ts. Runs server-side in the App
 * Router so the converter URL never leaks to the browser; the browser
 * only ever sees the resulting GLB ref via our same-origin /api/scene
 * proxy.
 */
import type { EnsRecord } from "./ens.js";

const CONVERTER_URL = process.env.NEXT_PUBLIC_CONVERTER_URL?.replace(/\/$/, "");

const USDZ_HINTS = ["usdz", "usd"];
const GLB_HINTS = ["gltf-binary", "model/gltf"];

/**
 * Sniff the upstream Content-Type so we don't bother converting GLB or
 * other already-renderable formats. HEAD is cheap and lets us avoid a
 * round-trip to the converter for non-USDZ scenes.
 */
async function probeFormat(beeRef: string): Promise<string | null> {
  const beeUrl = (
    process.env.NEXT_PUBLIC_BEE_LOCAL ??
    process.env.NEXT_PUBLIC_SWARM_GATEWAY ??
    "https://api.gateway.ethswarm.org"
  ).replace(/\/$/, "");
  try {
    const res = await fetch(`${beeUrl}/bzz/${beeRef}`, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (res.headers.get("content-type") ?? "").toLowerCase();
  } catch {
    return null;
  }
}

export async function maybeConvertScene(record: EnsRecord): Promise<EnsRecord> {
  if (!CONVERTER_URL || !record.content || record.content.protocol !== "bzz") {
    return record;
  }

  const ct = await probeFormat(record.content.ref);
  if (!ct) return record;

  // Already renderable in-canvas → skip the converter.
  if (GLB_HINTS.some((h) => ct.includes(h))) return record;

  // Not USDZ → unknown format, skip.
  if (!USDZ_HINTS.some((h) => ct.includes(h))) return record;

  try {
    const convertUrl = `${CONVERTER_URL}/convert?ref=${record.content.ref}&proto=bzz`;
    // Swarm refs are content-addressed so the GLB ref is stable per
    // input — force-cache lets Vercel edge serve the cached response.
    const res = await fetch(convertUrl, { cache: "force-cache" });
    if (!res.ok) {
      console.warn(`[converter] ${convertUrl} → ${res.status}`);
      return record;
    }
    const json = (await res.json()) as { glbRef?: string };
    if (!json.glbRef) return record;

    return {
      ...record,
      content: { protocol: "bzz", ref: json.glbRef },
    };
  } catch (e) {
    console.warn(`[converter] convert failed: ${(e as Error).message}`);
    return record;
  }
}
