import { Router, type Router as RouterT } from "express";
import { z } from "zod";
import { privateKeyToAccount } from "viem/accounts";
import { mintRealityProof } from "../services/chain.service.js";
import { ApiError } from "../middleware/error.middleware.js";
import { env } from "../config/env.js";
import type { Address, Hex } from "viem";

const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";
const HEX_RE = /^0x[0-9a-fA-F]*$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HASH32_RE = /^0x[0-9a-fA-F]{64}$/;

/**
 * iOS-canonical mint shape: required (swarmRef, bundleRef, bundleHash,
 * satSig, cosmoSig, attestation, attestationType, capturedAt, mode);
 * `to`/`attestor`/`recipient` all optional (defaulted server-side).
 *
 * Sentinels accepted in attestation/satSig: "MOCK", "STUB", "" — all
 * coerced to a single placeholder byte so the contract's non-empty check
 * passes during dev.
 */
const MintBody = z.object({
  swarmRef: z.string().min(1),
  bundleRef: z.string().min(1),
  bundleHash: z.string().regex(HASH32_RE, "bundleHash must be 0x + 64 hex"),
  satSig: z.string().default("STUB"),
  cosmoSig: z.string().default(""),
  attestation: z.string().default("MOCK"),
  attestationType: z.coerce.number().int().min(0).max(1).default(0),
  attestor: z.string().regex(ADDRESS_RE).optional(),
  to: z.string().regex(ADDRESS_RE).optional(),
  recipient: z.string().regex(ADDRESS_RE).optional(),
  capturedAt: z.coerce.number().int().nonnegative(),
  mode: z.coerce.number().int().min(0).max(2),
});

export const mintRouter: RouterT = Router();

mintRouter.post("/", async (req, res, next) => {
  try {
    const parsed = MintBody.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError("INVALID_BUNDLE", parsed.error.message);
    }
    const a = parsed.data;

    // Default recipient = backend's minter address. iOS leaves this empty
    // because the user doesn't have a wallet; backend mints to itself and
    // distributes later (or the `to` field is set by camera-agent's org wallet).
    const minterAddr = privateKeyToAccount(env().MINTER_PRIVATE_KEY as Hex).address;
    const recipient = (a.to ?? a.recipient ?? minterAddr) as Address;
    const attestor = (a.attestor ?? ZERO_ADDRESS) as Address;

    const result = await mintRealityProof({
      to: recipient,
      bundleHash: a.bundleHash as Hex,
      swarmRef: a.swarmRef,
      bundleRef: a.bundleRef,
      satSig: coerceBytes(a.satSig),
      cosmoSig: coerceBytes(a.cosmoSig),
      attestation: coerceAttestation(a.attestation),
      attestationType: a.attestationType as 0 | 1,
      attestor,
      capturedAt: BigInt(a.capturedAt),
      mode: a.mode as 0 | 1 | 2,
    });

    res.json({
      // iOS-canonical fields
      txHash: result.txHash,
      tokenId: result.tokenId,
      ensName: result.ensName,
      stub: false,
      // additive
      explorerUrl: `https://sepolia.basescan.org/tx/${result.txHash}`,
    });
  } catch (e) {
    if (e instanceof ApiError) {
      next(e);
      return;
    }
    next(new ApiError("MINT_FAILED", (e as Error).message, 502));
  }
});

/**
 * Coerce sentinels / empty / hex strings to a non-empty hex bytes value.
 * The contract's mint() reverts on empty satSig and empty attestation,
 * so we substitute a single placeholder byte for missing values.
 */
function coerceBytes(value: string): Hex {
  if (!value || value === "STUB" || value === "MOCK") return "0x00";
  if (HEX_RE.test(value)) return (value === "0x" ? "0x00" : (value as Hex));
  return "0x00";
}

/**
 * Attestation can arrive as base64 (App Attest assertion blob) or hex
 * (deviceSE signature). Auto-detect.
 */
function coerceAttestation(value: string): Hex {
  if (!value || value === "MOCK" || value === "STUB") return "0x00";
  if (HEX_RE.test(value)) return (value === "0x" ? "0x00" : (value as Hex));
  // Treat as base64 — iOS sends App Attest assertion this way.
  try {
    const buf = Buffer.from(value, "base64");
    if (buf.length === 0) return "0x00";
    return ("0x" + buf.toString("hex")) as Hex;
  } catch {
    return "0x00";
  }
}
