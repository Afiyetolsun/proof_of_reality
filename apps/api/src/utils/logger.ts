import { env } from "../config/env.js";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

const REDACT_KEYS = new Set([
  "MINTER_PRIVATE_KEY",
  "ORBITPORT_CLIENT_SECRET",
  "IOS_SHARED_SECRET",
  "PINATA_JWT",
  "assertion", // App Attest
  "deviceSig",
]);

function redact(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = REDACT_KEYS.has(k) ? "[redacted]" : redact(v);
  }
  return out;
}

function log(level: Level, msg: string, meta?: Record<string, unknown>) {
  const cur = LEVELS[env().LOG_LEVEL];
  if (LEVELS[level] < cur) return;
  const line = { level, msg, time: new Date().toISOString(), ...(meta ? { meta: redact(meta) } : {}) };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line));
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
};
