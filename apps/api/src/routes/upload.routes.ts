import { Router } from "express";
import multer from "multer";
import {
  parseProofBundle,
  bundleHash,
  deviceSigningHash,
  type ProofBundle,
} from "@proof-of-reality/proof-bundle";
import { verifyDeviceSig, verifyAppAttest } from "@proof-of-reality/attestation";
import { uploadToSwarm } from "../services/swarm.service.js";
import { cosignBundle } from "../services/orbitport.service.js";
import { isDeviceActive } from "../services/chain.service.js";
import { env } from "../config/env.js";
import { ApiError } from "../middleware/error.middleware.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB cap
});

export const uploadRouter = Router();

/**
 * POST /api/upload — multipart/form-data
 *   - scene: binary scene file (USDZ / PLY / GLB)
 *   - bundle: application/json — ProofBundle WITHOUT spaceFabric.cosmoSig populated
 *
 * Steps:
 *   1. Parse + validate bundle
 *   2. Verify device/app attestation against deviceSigningHash(bundle)
 *   3. Call KMS sign(deviceSigningHash) → cosmoSig
 *   4. Inject spaceFabric block, recompute final bundleHash
 *   5. Upload scene + final bundle JSON to Swarm (two refs)
 *   6. Return refs + final bundleHash
 */
uploadRouter.post(
  "/",
  upload.fields([
    { name: "scene", maxCount: 1 },
    { name: "bundle", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]>;
      const sceneFile = files?.scene?.[0];
      const bundleFile = files?.bundle?.[0];
      if (!sceneFile || !bundleFile) {
        throw new ApiError("INVALID_BUNDLE", "scene and bundle parts are required");
      }

      const bundleJson = JSON.parse(bundleFile.buffer.toString("utf8")) as unknown;
      let bundle: ProofBundle;
      try {
        bundle = parseProofBundle(bundleJson);
      } catch (e) {
        throw new ApiError("INVALID_BUNDLE", `schema mismatch: ${(e as Error).message}`);
      }

      const innerHash = deviceSigningHash(bundle);

      if (bundle.attestation.type === "deviceSE") {
        const r = await verifyDeviceSig(bundle, innerHash);
        if (!r.ok) {
          throw new ApiError("ATTESTATION_INVALID", `deviceSE: ${r.reason}`, 401);
        }
        const active = await isDeviceActive(bundle.attestation.deviceSE.deviceAddr as `0x${string}`);
        if (!active) {
          throw new ApiError("DEVICE_NOT_REGISTERED", "device not in registry or revoked", 401);
        }
      } else {
        const r = await verifyAppAttest(bundle, new TextEncoder().encode(innerHash));
        if (!r.ok) {
          throw new ApiError("ATTESTATION_INVALID", `appAttest: ${r.reason}`, 401);
        }
      }

      const cosmoSig = await cosignBundle(innerHash);

      const finalBundle: ProofBundle = {
        ...bundle,
        spaceFabric: {
          cosmoSig: cosmoSig,
          kmsPk: (env().KMS_COSIGNER_PUBKEY ?? null) as `0x${string}` | null,
          kmsKeyId: env().KMS_COSIGNER_KEY_ID ?? null,
          experimental: true,
        },
      };

      const finalHash = bundleHash(finalBundle);
      const finalBundleBytes = new TextEncoder().encode(JSON.stringify(finalBundle));

      const [sceneRes, bundleRes] = await Promise.all([
        uploadToSwarm(new Uint8Array(sceneFile.buffer)),
        uploadToSwarm(finalBundleBytes),
      ]);

      res.json({
        swarmRef: sceneRes.reference,
        bundleRef: bundleRes.reference,
        sceneSize: sceneRes.sizeBytes,
        bundleHash: finalHash,
        cosmoSig,
      });
    } catch (e) {
      next(e);
    }
  },
);
