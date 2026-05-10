/**
 * Server-side USDZ → GLB conversion lookup.
 *
 * Given an ENS contenthash that resolves to a USDZ on Swarm, ask the
 * converter service (infra/converter/, runs alongside Bee on the VPS)
 * for the GLB version. Returns the GLB Swarm ref if conversion
 * succeeded — null otherwise (the page falls back to the QuickLook
 * card).
 *
 * This runs server-side in the App Router, so the converter URL never
 * leaks to the browser; the browser only ever sees the resulting GLB
 * ref via our same-origin /api/scene proxy.
 */

import type { EnsRecord } from "./ens";

const CONVERTER_URL = process.env.NEXT_PUBLIC_CONVERTER_URL?.replace(/\/$/, "");

/**
 * Sniff the upstream Content-Type so we don't bother converting GLB or
 * other already-renderable formats. HEAD is cheap and lets us avoid a
 * round-trip to the converter for non-USDZ scenes.
 */
async function probeFormat(beeRef: string): Promise<string | null> {
  const beeUrl = (process.env.NEXT_PUBLIC_BEE_LOCAL ??
    process.env.NEXT_PUBLIC_SWARM_GATEWAY ??
    "https://api.gateway.ethswarm.org").replace(/\/$/, "");
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

const GLB_HINTS = ["gltf-binary", "model/gltf"];

/**
 * If the record's contenthash points at content on Swarm AND the
 * converter is configured, returns a new EnsRecord whose `content`
 * field has been swapped for the converted GLB ref. Otherwise returns
 * the record unchanged.
 *
 * We only short-circuit the converter call for *confirmed* GLB content.
 * If the format probe is inconclusive (the public Swarm gateway is
 * flaky from serverless networks — HEAD often returns no content-type
 * or stalls), we still ask the converter rather than silently falling
 * back to the QuickLook card. The converter holds its own JSON cache
 * keyed on USDZ ref, so a known ref answers in ~50 ms whether or not
 * the gateway probe succeeded.
 *
 * No fetch caching: the converter is the cache. Vercel's data cache
 * used to retain transient converter failures and serve them
 * indefinitely; `cache: "no-store"` keeps every request fresh while
 * the converter's disk cache keeps it cheap.
 *
 * Failure modes degrade to the original record so the page still
 * renders the QuickLook fallback rather than erroring.
 */
export async function maybeConvertScene(record: EnsRecord): Promise<EnsRecord> {
  if (!CONVERTER_URL || !record.content || record.content.protocol !== "bzz") {
    return record;
  }

  // Only skip the converter when we're *certain* the content is already
  // GLB. Inconclusive probes (gateway 4xx, missing content-type, network
  // flake) should still hit the converter — its cache is authoritative.
  const ct = await probeFormat(record.content.ref);
  if (ct && GLB_HINTS.some((h) => ct.includes(h))) {
    return record;
  }

  try {
    const convertUrl = `${CONVERTER_URL}/convert?ref=${record.content.ref}&proto=bzz`;
    const res = await fetch(convertUrl, { cache: "no-store" });
    if (!res.ok) {
      console.warn(`[converter] ${convertUrl} → ${res.status}`);
      return record;
    }
    // Manual parse so a non-JSON body doesn't surface as a "Console
    // SyntaxError" overlay in Next.js dev mode. See gallery's
    // converter.ts for the longer rationale.
    const text = await res.text();
    let json: { glbRef?: string };
    try {
      json = JSON.parse(text) as { glbRef?: string };
    } catch {
      console.warn(
        `[converter] ${convertUrl} returned non-JSON: ${text.slice(0, 80)}…`,
      );
      return record;
    }
    if (!json.glbRef) {
      console.warn(`[converter] ${convertUrl} returned no glbRef`);
      return record;
    }
    console.log(
      `[converter] ${record.content.ref.slice(0, 12)}… → ${json.glbRef.slice(0, 12)}…`,
    );
    return {
      ...record,
      content: { protocol: "bzz", ref: json.glbRef },
    };
  } catch (e) {
    console.warn(`[converter] convert failed: ${(e as Error).message}`);
    return record;
  }
}
