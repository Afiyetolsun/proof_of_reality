import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

/**
 * Shared-secret middleware. Per-client header → per-client secret:
 *
 *   X-Voxelio-Key   ↔ IOS_SHARED_SECRET     (iOS app)
 *   X-Camera-Key    ↔ CAMERA_SHARED_SECRET  (OAK + USB Armory, 3rd-party cams)
 *   Authorization:Bearer ↔ either           (CLI tools, smoke-mint, curl)
 *
 * A header presenting the wrong-class secret is rejected — no cross-talk
 * between iOS and camera credentials. Constant-time comparison.
 *
 * The matched client class is attached to req.authClient ("ios" | "camera")
 * for downstream logging/policy. NOT the cryptographic trust boundary —
 * that's the device/App-Attest signature inside the bundle. This is just
 * a coarse "stop random internet" filter and a way to issue/rotate keys
 * per client.
 */
export type AuthClient = "ios" | "camera";

declare module "express" {
  interface Request {
    authClient?: AuthClient;
  }
}

function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const e = env();
  const iosKey = req.header("x-voxelio-key");
  const camKey = req.header("x-camera-key");
  const bearer = req.header("authorization")?.match(/^Bearer\s+(.+)$/)?.[1];

  if (iosKey !== undefined) {
    if (constantTimeEquals(iosKey, e.IOS_SHARED_SECRET)) {
      req.authClient = "ios";
      next();
      return;
    }
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "bad X-Voxelio-Key" } });
    return;
  }

  if (camKey !== undefined) {
    if (e.CAMERA_SHARED_SECRET && constantTimeEquals(camKey, e.CAMERA_SHARED_SECRET)) {
      req.authClient = "camera";
      next();
      return;
    }
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: e.CAMERA_SHARED_SECRET
          ? "bad X-Camera-Key"
          : "X-Camera-Key presented but CAMERA_SHARED_SECRET not configured on server",
      },
    });
    return;
  }

  if (bearer !== undefined) {
    if (constantTimeEquals(bearer, e.IOS_SHARED_SECRET)) {
      req.authClient = "ios";
      next();
      return;
    }
    if (e.CAMERA_SHARED_SECRET && constantTimeEquals(bearer, e.CAMERA_SHARED_SECRET)) {
      req.authClient = "camera";
      next();
      return;
    }
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "bad bearer token" } });
    return;
  }

  res.status(401).json({
    error: {
      code: "UNAUTHORIZED",
      message: "missing X-Voxelio-Key, X-Camera-Key, or Authorization: Bearer",
    },
  });
}
