/**
 * Server-side USDZ → GLB conversion lookup.
 *
 * Given an ENS contenthash that resolves to a USDZ on Swarm, ask the
 * converter service (infra/converter/, runs alongside Bee on the VPS)
 * for the GLB version. Returns a new EnsRecord whose content ref has
 * been swapped for the GLB ref if conversion succeeded — otherwise the
 * record unchanged so the page renders the QuickLook fallback.
 *
 * Runs server-side in the App Router so the converter URL never leaks
 * to the browser; the browser only ever sees the resulting GLB ref via
 * our same-origin /api/scene proxy.
 *
 * Why we no longer gate on probeFormat alone: the public Swarm gateway
 * is flaky over Vercel's outbound network — HEAD requests stall or
 * return missing content-types intermittently, and when they did, this
 * file used to silently return the original USDZ record (you'd see
 * "Open in QuickLook" instead of an in-browser GLB even though the
 * converter had a cached GLB ready). Now: if the format probe is
 * inconclusive but the ref is on Swarm, we *still* ask the converter,
 * which holds its own cache and answers in milliseconds for known
 * refs. Only known-GLB content short-circuits the converter call.
 *
 * Also: no fetch caching here. The converter is the cache. Vercel's
 * data cache used to retain transient converter failures and serve
 * them indefinitely; explicit `cache: "no-store"` keeps every request
 * fresh while the converter's own JSON cache keeps it cheap.
 */
import type { EnsRecord } from "./ens.js";

const CONVERTER_URL = process.env.NEXT_PUBLIC_CONVERTER_URL?.replace(/\/$/, "");

const GLB_HINTS = ["gltf-binary", "model/gltf"];

/**
 * Best-effort format sniff. Returns the lower-cased content-type if
 * Bee/the gateway responds, null otherwise. Used only to short-circuit
 * the converter for content that's already GLB — when this returns
 * null we fall through to the converter regardless.
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

  // Only short-circuit for *confirmed* GLB. If the probe is inconclusive
  // (null content-type, gateway hiccup, anything we can't interpret) we
  // still ask the converter — its cache is the source of truth for what
  // we've converted, and a cached lookup is ~50 ms.
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
    const json = (await res.json()) as { glbRef?: string };
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
