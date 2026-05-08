import { Router, type Router as RouterT } from "express";
import multer from "multer";
import { createHash } from "node:crypto";
import { uploadToSwarm } from "../services/swarm.service.js";
import { cosignBundle } from "../services/orbitport.service.js";
import { ApiError } from "../middleware/error.middleware.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB cap per file
});

export const uploadRouter: RouterT = Router();

/**
 * POST /api/upload — multipart/form-data
 *   - bundle: application/json (the ProofBundle bytes, opaque to backend)
 *   - scene: binary scene (USDZ / GLB / PLY)
 *   - audio: optional binary (m4a) — visible-nonce audio binding
 *
 * The bundle is treated as opaque bytes: we hash it via SHA-256 (matching
 * iOS's ProofHasher.canonicalEncode + SHA-256) and pin it to storage. This
 * keeps the wire shape neutral about the bundle's schema.
 *
 * Steps:
 *   1. SHA-256 the bundle bytes → bundleHash
 *   2. KMS-cosign that hash via secp256k1 → cosmoSig
 *   3. Pin scene + bundle (and audio if present) to Pinata/Swarm
 *   4. Return iOS-canonical fields { swarmRef, bundleHash } plus
 *      additive fields the viewer reads
 */
uploadRouter.post(
  "/",
  upload.fields([
    { name: "bundle", maxCount: 1 },
    { name: "scene", maxCount: 1 },
    { name: "audio", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const bundleFile = files?.bundle?.[0];
      const sceneFile = files?.scene?.[0];
      const audioFile = files?.audio?.[0];
      if (!bundleFile) throw new ApiError("INVALID_BUNDLE", 'multipart "bundle" part is required');
      if (!sceneFile) throw new ApiError("INVALID_BUNDLE", 'multipart "scene" part is required');

      const bundleHashHex = ("0x" +
        createHash("sha256").update(bundleFile.buffer).digest("hex")) as `0x${string}`;

      const cosmoSig = await cosignBundle(bundleHashHex);

      const [scenePin, bundlePin, audioPin] = await Promise.all([
        uploadToSwarm(new Uint8Array(sceneFile.buffer)),
        uploadToSwarm(new Uint8Array(bundleFile.buffer)),
        audioFile
          ? uploadToSwarm(new Uint8Array(audioFile.buffer))
          : Promise.resolve(null),
      ]);

      res.json({
        // iOS-canonical fields
        swarmRef: scenePin.reference,
        bundleHash: bundleHashHex,
        // additive fields used by the viewer + camera-agent
        bundleRef: bundlePin.reference,
        audioRef: audioPin?.reference ?? null,
        sceneBytes: scenePin.sizeBytes,
        cosmoSig,
      });
    } catch (e) {
      next(e);
    }
  },
);
