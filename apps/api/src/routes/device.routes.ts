import { Router } from "express";
import { z } from "zod";
import { isDeviceActive } from "../services/chain.service.js";
import { ApiError } from "../middleware/error.middleware.js";
import type { Address } from "viem";

export const deviceRouter = Router();

/**
 * GET /api/device/:addr — public lookup (used by the viewer to verify device sigs).
 * Reads DeviceRegistry on-chain, returns { active, ... }.
 */
deviceRouter.get("/:addr", async (req, res, next) => {
  try {
    const addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/).parse(req.params.addr) as Address;
    const active = await isDeviceActive(addr);
    res.json({ address: addr, active });
  } catch (e) {
    next(new ApiError("INVALID_BUNDLE", (e as Error).message));
  }
});

/**
 * POST /api/device/register — provisioning helper.
 *
 * The org's wallet should ideally call DeviceRegistry.register() directly so
 * msg.sender == orgAddr. This route exists for demos where the org wants the
 * backend to relay (with org pre-signed calldata or signature). Stub for now.
 */
deviceRouter.post("/register", async (_req, _res, next) => {
  next(new ApiError("NOT_IMPLEMENTED", "register the device directly via DeviceRegistry.register()", 501));
});
