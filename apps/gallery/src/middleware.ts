/**
 * Cross-Origin-Opener-Policy + Cross-Origin-Embedder-Policy on every
 * non-internal route. Required to enable SharedArrayBuffer, which
 * Pixar's USD WASM bundle (used by three-usdz-loader to render USDZ
 * scenes in browser) needs.
 *
 * We set it site-wide so both the gallery grid (with inline 3D card
 * previews) and the per-name detail pages can render USDZ. The
 * negative-lookahead matcher avoids isolating responses from the
 * scene proxy, the model-viewer script, or static assets — those
 * carry their own CORP headers (see next.config.ts).
 *
 * ENS names contain dots (vin-….realityproof.eth), so we can't match
 * by file extension; the lookahead lists every static-asset extension
 * we care about explicitly.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  void req;
  const res = NextResponse.next();
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  return res;
}

export const config = {
  matcher: [
    "/((?!api/|_next/|model-viewer|emHdBindings|favicon|.*\\.(?:ico|svg|png|jpg|jpeg|gif|webp|css|js|json|txt|xml|woff|woff2|wasm|data|map|webmanifest)$).*)",
  ],
};
