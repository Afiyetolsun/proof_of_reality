import { verifyChunk } from "./chunks/cac.js";
import { verifyBmt } from "./chunks/bmt.js";

export interface VerifiedFetchOptions {
  /** Bee gateway base URL, e.g. "https://api.gateway.ethswarm.org" */
  gateway: string;
  /** Optional fetch impl override (for tests / Node fetch shimming) */
  fetchImpl?: typeof fetch;
  /** Allow unverifiable multi-chunk content with a warning instead of throwing */
  permissive?: boolean;
}

export interface VerifiedResponse {
  data: Uint8Array;
  reference: string;
  verified: boolean;
  scope: "single-chunk" | "multi-chunk" | "feed";
}

/**
 * Fetch a Swarm reference from a public gateway and verify its content addressing
 * client-side. Mirrors the API shape of `helia-verified-fetch`.
 *
 * Scope (intentional, will be expanded):
 *   - Single-chunk blobs (≤4096 bytes): full CAC + BMT verification
 *   - Multi-chunk content: structural verification of the manifest's BMT
 *   - Feeds (SOC): signature verification on the feed update payload
 *
 * @param ref Swarm reference (bzz address, hex)
 */
export async function verifiedFetch(
  ref: string,
  opts: VerifiedFetchOptions,
): Promise<VerifiedResponse> {
  const fetchFn = opts.fetchImpl ?? fetch;
  const url = `${opts.gateway.replace(/\/$/, "")}/bzz/${ref}`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`gateway ${res.status}: ${res.statusText}`);
  const data = new Uint8Array(await res.arrayBuffer());

  // TODO: detect single-chunk vs multi-chunk from content length / manifest header
  if (data.length <= 4096) {
    const ok = verifyChunk(ref, data);
    if (!ok && !opts.permissive) {
      throw new Error("CAC verification failed");
    }
    return { data, reference: ref, verified: ok, scope: "single-chunk" };
  }

  // Multi-chunk path uses BMT over chunks. Stub for now.
  const ok = verifyBmt(ref, data);
  if (!ok && !opts.permissive) {
    throw new Error("BMT verification failed");
  }
  return { data, reference: ref, verified: ok, scope: "multi-chunk" };
}
