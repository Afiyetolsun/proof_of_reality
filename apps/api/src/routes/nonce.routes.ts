import { Router, type Router as RouterT } from "express";
import { getCosmicNonce } from "../services/orbitport.service.js";
import { ApiError } from "../middleware/error.middleware.js";

export const nonceRouter: RouterT = Router();

/**
 * POST /api/nonce — relay a fresh cosmic nonce from SpaceComputer Orbitport.
 *
 * Body: empty.
 * Response (iOS-shaped, with our extras as additive fields):
 *   { nonce, satSig, expiresAt, src?, satPk?, value?, issuedAt? }
 *
 * iOS reads `nonce`, `satSig`, `expiresAt` (all strings/numbers).
 * Our viewer can additionally read `satPk` for verification independence.
 *
 * The nonce is good for ~10min — clients should call this right before capture starts.
 */
nonceRouter.post("/", async (_req, res, next) => {
  try {
    const nonce = await getCosmicNonce();
    const expiresAt = nonce.issuedAt + 600;
    res.json({
      // iOS-canonical shape (flat strings)
      nonce: nonce.value,
      satSig: nonce.satSig?.value ?? "",
      expiresAt,
      // additive fields for the viewer / camera-agent
      satPk: nonce.satSig?.pk ?? null,
      src: nonce.src,
      value: nonce.value,
      issuedAt: nonce.issuedAt,
      provider: nonce.provider ?? null,
    });
  } catch (e) {
    next(new ApiError("ORBITPORT_UNAVAILABLE", (e as Error).message, 503));
  }
});
