import { z } from "zod";

export const PROOF_BUNDLE_VERSION = "1.0" as const;

export const CAPTURE_MODES = ["roomPlan", "objectCapture", "stereoFusion"] as const;
export type CaptureMode = (typeof CAPTURE_MODES)[number];

export const SCENE_FORMATS = ["usdz", "ply", "glb", "obj"] as const;
export type SceneFormat = (typeof SCENE_FORMATS)[number];

export const NONCE_SOURCES = ["trng", "rng", "ipfs"] as const;
export type NonceSource = (typeof NONCE_SOURCES)[number];

export const NONCE_BINDINGS = ["visualQR", "audioTTS", "sensorSeed"] as const;
export type NonceBinding = (typeof NONCE_BINDINGS)[number];

export const ATTESTATION_TYPES = ["appAttest", "deviceSE"] as const;
export type AttestationType = (typeof ATTESTATION_TYPES)[number];

export const SE_VENDORS = ["usb-armory-mk2", "atecc608", "se05x"] as const;
export type SecureElementVendor = (typeof SE_VENDORS)[number];

const HexString = z.string().regex(/^0x[0-9a-fA-F]+$/, "must be 0x-prefixed hex");

export const SatelliteSignatureSchema = z.object({
  value: HexString,
  pk: HexString,
});

// Server-side `src` widens beyond the original three: when the satellite is
// out of coverage, Orbitport returns `src: "derived"` with no per-call sig.
export const NonceSchema = z.object({
  value: HexString,
  src: z.string(),
  satSig: SatelliteSignatureSchema.nullable().optional(),
  issuedAt: z.number().int().positive(),
  binding: z.array(z.enum(NONCE_BINDINGS)).nonempty(),
});

export const SpaceFabricSchema = z.object({
  cosmoSig: HexString.nullable(),
  kmsPk: HexString.nullable(),
  kmsKeyId: z.string().nullable(),
  experimental: z.boolean().default(true),
});

export const AppAttestSchema = z.object({
  keyId: z.string(),
  assertion: z.string(),
});

export const DeviceSESchema = z.object({
  deviceAddr: HexString,
  deviceSig: HexString,
  vendor: z.enum(SE_VENDORS),
  vendorAttestation: z.string().optional(),
});

export const AttestationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("appAttest"),
    appAttest: AppAttestSchema,
  }),
  z.object({
    type: z.literal("deviceSE"),
    deviceSE: DeviceSESchema,
  }),
]);

export const DeviceInfoSchema = z.object({
  model: z.string(),
  os: z.string(),
  appVersion: z.string(),
});

export const CaptureSchema = z
  .object({
    startedAt: z.number().int().positive(),
    endedAt: z.number().int().positive(),
    frames: z.number().int().nonnegative(),
    sceneFormat: z.enum(SCENE_FORMATS),
  })
  .refine((c) => c.endedAt >= c.startedAt, {
    message: "endedAt must be >= startedAt",
  });

export const GpsSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  alt: z.number(),
  hAcc: z.number().nonnegative(),
});

export const SensorsSchema = z.object({
  imu: z.string(),
  gps: GpsSchema.optional(),
  baro: z.number().optional(),
});

export const ProofBundleSchema = z.object({
  version: z.literal(PROOF_BUNDLE_VERSION),
  mode: z.enum(CAPTURE_MODES),
  device: DeviceInfoSchema,
  capture: CaptureSchema,
  nonce: NonceSchema,
  spaceFabric: SpaceFabricSchema,
  sensors: SensorsSchema,
  attestation: AttestationSchema,
});

export type ProofBundle = z.infer<typeof ProofBundleSchema>;
export type Attestation = z.infer<typeof AttestationSchema>;
export type Nonce = z.infer<typeof NonceSchema>;
export type SpaceFabric = z.infer<typeof SpaceFabricSchema>;

export function parseProofBundle(input: unknown): ProofBundle {
  return ProofBundleSchema.parse(input);
}

export function safeParseProofBundle(input: unknown) {
  return ProofBundleSchema.safeParse(input);
}
