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
 *   - bundle: application/json (REQUIRED, the ProofBundle bytes, opaque to backend)
 *   - scene:  binary scene (OPTIONAL, USDZ / GLB / PLY)
 *   - audio:  optional binary (m4a) — visible-nonce audio binding
 *
 * Scene is OPTIONAL so iOS can use this endpoint for cosign-only when
 * the scene is too big for Vercel's 4.5 MB body limit. In that path,
 * iOS uploads the scene directly to the Bee node (which has no such
 * limit) and threads the resulting swarmRef into /api/mint. iOS still
 * POSTs the bundle here so the backend can produce bundleHash +
 * cosmoSig — the two things only the backend can do.
 *
 * Steps:
 *   1. SHA-256 the bundle bytes → bundleHash
 *   2. KMS-cosign that hash via secp256k1 → cosmoSig
 *   3. Pin bundle (always); also pin scene + audio if the client sent them
 *   4. Return iOS-canonical fields. swarmRef is null when caller
 *      uploaded the scene out-of-band.
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

      const bundleHashHex = ("0x" +
        createHash("sha256").update(bundleFile.buffer).digest("hex")) as `0x${string}`;

      const cosmoSig = await cosignBundle(bundleHashHex);

      // Pass through filename + mimetype so Bee/Pinata serve the file
      // with proper Content-Type + Content-Disposition.
      const sceneMime = sceneFile?.mimetype || (sceneFile && mimeFromName(sceneFile.originalname));
      const audioMime = audioFile?.mimetype || (audioFile && mimeFromName(audioFile.originalname));

      const [scenePin, bundlePin, audioPin] = await Promise.all([
        sceneFile
          ? uploadToSwarm(new Uint8Array(sceneFile.buffer), sceneFile.originalname, sceneMime)
          : Promise.resolve(null),
        uploadToSwarm(new Uint8Array(bundleFile.buffer), "bundle.json", "application/json"),
        audioFile
          ? uploadToSwarm(new Uint8Array(audioFile.buffer), audioFile.originalname, audioMime)
          : Promise.resolve(null),
      ]);

      res.json({
        // iOS-canonical fields
        swarmRef: scenePin?.reference ?? null,
        bundleHash: bundleHashHex,
        // additive fields used by the viewer + camera-agent
        bundleRef: bundlePin.reference,
        audioRef: audioPin?.reference ?? null,
        sceneBytes: scenePin?.sizeBytes ?? null,
        cosmoSig,
      });
    } catch (e) {
      next(e);
    }
  },
);

/** Best-effort MIME guess from filename — backstop when multer doesn't
 *  provide a useful mimetype (some iOS multipart configs don't). */
function mimeFromName(name: string | undefined): string {
  if (!name) return "application/octet-stream";
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    usdz: "model/vnd.usdz+zip",
    glb: "model/gltf-binary",
    gltf: "model/gltf+json",
    obj: "text/plain",
    m4a: "audio/mp4",
    mp4: "audio/mp4",
    aac: "audio/aac",
    wav: "audio/wav",
    json: "application/json",
  };
  return map[ext] ?? "application/octet-stream";
}
