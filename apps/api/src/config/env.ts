import { z } from "zod";

const EnvSchema = z.object({
  IOS_SHARED_SECRET: z.string().min(16),

  ORBITPORT_CLIENT_ID: z.string().min(1),
  ORBITPORT_CLIENT_SECRET: z.string().min(1),
  KMS_COSIGNER_KEY_ID: z.string().optional(),
  KMS_COSIGNER_PUBKEY: z.string().optional(),

  SWARM_BEE_URL: z.string().url(),
  SWARM_POSTAGE_BATCH_ID: z.string().min(1).optional(),
  STORAGE_BACKEND: z.enum(["swarm", "ipfs"]).default("swarm"),
  PINATA_JWT: z.string().optional(),

  BASE_SEPOLIA_RPC: z.string().url(),
  MINTER_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "expected 0x-hex 64-char private key"),
  REALITY_PROOF_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  DEVICE_REGISTRY_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/),

  ENS_PARENT_DOMAIN: z.string().optional(),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("[env] invalid:", parsed.error.flatten().fieldErrors);
    throw new Error("Environment variable validation failed");
  }
  cached = parsed.data;
  return cached;
}
