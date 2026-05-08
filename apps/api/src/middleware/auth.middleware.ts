import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

/**
 * Shared-secret middleware. iOS sends `X-Voxelio-Key: <secret>`; camera-agent
 * and CLI tools send `Authorization: Bearer <secret>`. Either is accepted —
 * they're checked against the same IOS_SHARED_SECRET in constant time.
 *
 * NOT the cryptographic trust boundary — that's the device/App-Attest signature
 * inside the bundle. This is just a coarse "stop random internet" filter.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const xKey = req.header("x-voxelio-key");
  const bearer = req.header("authorization")?.match(/^Bearer\s+(.+)$/)?.[1];
  const presented = xKey ?? bearer;
  if (!presented) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "missing X-Voxelio-Key or Bearer token" },
    });
    return;
  }
  const provided = Buffer.from(presented);
  const expected = Buffer.from(env().IOS_SHARED_SECRET);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "bad shared secret" } });
    return;
  }
  next();
}
