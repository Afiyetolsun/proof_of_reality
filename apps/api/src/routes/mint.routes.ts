import { Router, type Router as RouterT } from "express";
import { z } from "zod";
import { mintRealityProof } from "../services/chain.service.js";
import { ApiError } from "../middleware/error.middleware.js";
import type { Address, Hex } from "viem";

const MintBody = z.object({
  to: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  bundleHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  swarmRef: z.string().min(1),
  bundleRef: z.string().min(1),
  satSig: z.string().regex(/^0x[0-9a-fA-F]+$/),
  cosmoSig: z.string().regex(/^0x[0-9a-fA-F]*$/), // may be empty
  attestation: z.string().regex(/^0x[0-9a-fA-F]+$/),
  attestationType: z.union([z.literal(0), z.literal(1)]),
  attestor: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  capturedAt: z.coerce.bigint().positive(),
  mode: z.union([z.literal(0), z.literal(1), z.literal(2)]),
});

export const mintRouter: RouterT = Router();

mintRouter.post("/", async (req, res, next) => {
  try {
    const parsed = MintBody.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError("INVALID_BUNDLE", parsed.error.message);
    }
    const a = parsed.data;
    const txHash = await mintRealityProof({
      to: a.to as Address,
      bundleHash: a.bundleHash as Hex,
      swarmRef: a.swarmRef,
      bundleRef: a.bundleRef,
      satSig: a.satSig as Hex,
      cosmoSig: (a.cosmoSig.length > 2 ? a.cosmoSig : "0x") as Hex,
      attestation: a.attestation as Hex,
      attestationType: a.attestationType,
      attestor: a.attestor as Address,
      capturedAt: a.capturedAt,
      mode: a.mode,
    });
    res.json({
      txHash,
      explorerUrl: `https://sepolia.basescan.org/tx/${txHash}`,
    });
  } catch (e) {
    next(new ApiError("MINT_FAILED", (e as Error).message, 502));
  }
});
