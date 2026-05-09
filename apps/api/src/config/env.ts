import { z } from "zod";

const EnvSchema = z.object({
  IOS_SHARED_SECRET: z.string().min(16),
  // Separate secret for 3rd-party cameras (OAK + USB Armory etc.). Optional —
  // when unset the auth middleware only accepts the iOS secret, preserving
  // existing behaviour. Issue + rotate independently of IOS_SHARED_SECRET.
  CAMERA_SHARED_SECRET: z.string().min(16).optional(),

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

  // ENS — lives on Ethereum Sepolia (separate chain from Base Sepolia where the NFT lives).
  // All optional: if any is missing, /api/mint still mints, just skips ENS publication.
  ETH_SEPOLIA_RPC: z.string().url().optional(),
  ENS_PARENT_NAME: z.string().optional(),
  ENS_RESOLVER_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),

  ENS_PARENT_DOMAIN: z.string().optional(),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/**
 * Treat empty strings as missing so `optional()` actually works when a var is
 * present in .env but left blank (e.g. SWARM_POSTAGE_BATCH_ID before you've
 * picked one up).
 */
function sanitize(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    out[k] = v === "" ? undefined : v;
  }
  return out;
}

export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(sanitize(process.env));
  if (!parsed.success) {
    console.error("[env] invalid:", parsed.error.flatten().fieldErrors);
    throw new Error("Environment variable validation failed");
  }
  cached = parsed.data;
  return cached;
}
