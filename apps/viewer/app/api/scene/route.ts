/**
 * GET /api/scene?ref=<hex|cid>&proto=bzz|ipfs
 *
 * Server-side proxy that fetches a scene blob from Swarm or IPFS and
 * streams it back to the browser. Solves three real problems:
 *
 *   1. CORS — the upstream Bee node doesn't send Access-Control-* headers
 *      so a direct fetch from a viewer at a different origin fails with
 *      "TypeError: Failed to fetch".
 *   2. Mixed content — once the viewer is on HTTPS, browsers block
 *      cleartext http:// fetches to a Bee node that doesn't have TLS.
 *   3. Failover — if the local/VPS Bee is down or doesn't have the
 *      chunks yet, we fall back to the public Swarm gateway transparently.
 *
 * Returns the upstream Content-Type / Content-Disposition unchanged so
 * <model-viewer> sees the same model/gltf-binary or model/vnd.usdz+zip
 * MIME the gateway picked up from Bee's manifest.
 */

import { NextResponse } from "next/server";

const HEX64 = /^[0-9a-fA-F]{64}$/;
const CIDV0 = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;

const BEE_LOCAL = process.env.NEXT_PUBLIC_BEE_LOCAL?.replace(/\/$/, "");
const SWARM_PUBLIC =
  process.env.NEXT_PUBLIC_SWARM_GATEWAY?.replace(/\/$/, "") ??
  "https://api.gateway.ethswarm.org";
const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ref = searchParams.get("ref")?.trim();
  const proto = searchParams.get("proto");

  if (!ref) return NextResponse.json({ error: "missing ref" }, { status: 400 });
  if (proto !== "bzz" && proto !== "ipfs") {
    return NextResponse.json({ error: "proto must be bzz or ipfs" }, { status: 400 });
  }
  if (proto === "bzz" && !HEX64.test(ref)) {
    return NextResponse.json({ error: "bzz ref must be 64-hex" }, { status: 400 });
  }
  if (proto === "ipfs" && !CIDV0.test(ref)) {
    return NextResponse.json({ error: "ipfs ref must be a CIDv0 (Qm…)" }, { status: 400 });
  }

  const candidates: string[] = [];
  if (proto === "bzz") {
    if (BEE_LOCAL) candidates.push(`${BEE_LOCAL}/bzz/${ref}`);
    candidates.push(`${SWARM_PUBLIC}/bzz/${ref}`);
  } else {
    candidates.push(`${IPFS_GATEWAY}/${ref}`);
  }

  let lastError: string | null = null;
  for (const url of candidates) {
    try {
      const upstream = await fetch(url, {
        // Follow Bee's 308 redirect to /bzz/<ref>/ (single-file manifest).
        redirect: "follow",
        // Don't cache server-side — we're a proxy, not a CDN.
        cache: "no-store",
      });
      if (!upstream.ok) {
        lastError = `${url}: ${upstream.status} ${upstream.statusText}`;
        continue;
      }
      const headers = new Headers();
      const ct = upstream.headers.get("content-type");
      const cd = upstream.headers.get("content-disposition");
      const cl = upstream.headers.get("content-length");
      if (ct) headers.set("Content-Type", ct);
      if (cd) headers.set("Content-Disposition", cd);
      if (cl) headers.set("Content-Length", cl);
      // Allow embedding from any origin since the viewer might be hit
      // from anywhere (sharing surface).
      headers.set("Access-Control-Allow-Origin", "*");
      // Cache aggressively at the edge — these refs are content-addressed
      // and immutable, so we can serve forever.
      headers.set("Cache-Control", "public, max-age=31536000, immutable");

      return new NextResponse(upstream.body, { status: 200, headers });
    } catch (e) {
      lastError = `${url}: ${(e as Error).message}`;
    }
  }

  return NextResponse.json(
    { error: "all upstream fetches failed", lastError },
    { status: 502 },
  );
}

// Same handler for HEAD so the ProofScene's pre-mount probe works.
export async function HEAD(req: Request) {
  return GET(req);
}
