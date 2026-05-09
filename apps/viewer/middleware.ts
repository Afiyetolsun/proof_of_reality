/**
 * Set Cross-Origin-Opener-Policy + Cross-Origin-Embedder-Policy on the
 * /<name> verification route. Required to enable SharedArrayBuffer,
 * which Pixar's USD WASM bundle (used by three-usdz-loader to render
 * USDZ scenes in the browser) needs to work.
 *
 * Why middleware instead of next.config.ts headers():
 *   - ENS names contain dots (vin-….realityproof.eth)
 *   - Next.js's path-to-regexp source patterns can't easily match
 *     "anything not /api/_next/etc that may have dots" without false
 *     positives on file extensions
 *   - Middleware runs Node-style URL matching, no quirks
 *
 * The headers are NOT applied to:
 *   - /        (landing page — fine without isolation)
 *   - /api/*   (API routes — would break the same-origin proxy
 *               since the response itself can't be cross-origin)
 *   - /token/* (redirects to /<name>; never renders)
 *   - /_next/* (Next internals)
 *   - any path with a file extension (favicon, og-image, etc)
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  return res;
}

export const config = {
  // Run on /<name> routes only — anything that ISN'T an internal path
  // or a file with an extension. The negative-lookahead matcher avoids
  // headers being applied to /api/scene, /_next/static/*, /favicon.svg,
  // /model-viewer.min.js, etc.
  matcher: [
    // Negative lookahead avoids: API + Next internals + token redirect
    // route + USD WASM + the model-viewer script + any *static asset*
    // file extension. We can't simply exclude all paths-with-dots
    // because ENS names look like vin-….realityproof.eth.
    "/((?!api/|_next/|token/|usd/|model-viewer|favicon|.*\\.(?:ico|svg|png|jpg|jpeg|gif|webp|css|js|json|txt|xml|woff|woff2|map|webmanifest)$).*)",
  ],
};
