import { Router } from "express";
import { getCosmicNonce } from "../services/orbitport.service.js";
import { ApiError } from "../middleware/error.middleware.js";

export const nonceRouter = Router();

/**
 * POST /api/nonce — relay a fresh cosmic nonce from SpaceComputer Orbitport.
 *
 * Body: empty (auth via Bearer header).
 * Response: { value, src, satSig: { value, pk }, issuedAt, provider, expiresAt }
 *
 * The nonce is good for ~10min — clients should call this right before capture starts.
 */
nonceRouter.post("/", async (_req, res, next) => {
  try {
    const nonce = await getCosmicNonce();
    res.json({
      ...nonce,
      expiresAt: nonce.issuedAt + 600,
    });
  } catch (e) {
    next(new ApiError("ORBITPORT_UNAVAILABLE", (e as Error).message, 503));
  }
});
