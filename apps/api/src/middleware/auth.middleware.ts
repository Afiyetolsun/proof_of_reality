import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

/**
 * Bearer-token middleware. iOS and the camera-agent both send the same shared secret
 * via `Authorization: Bearer <IOS_SHARED_SECRET>`.
 *
 * This is NOT the cryptographic trust boundary — that's the device/App-Attest signature
 * inside the bundle. This is just a coarse "stop random internet traffic" filter.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const auth = req.header("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/);
  if (!m) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "missing bearer token" } });
    return;
  }
  const provided = Buffer.from(m[1]!);
  const expected = Buffer.from(env().IOS_SHARED_SECRET);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "bad bearer token" } });
    return;
  }
  next();
}
