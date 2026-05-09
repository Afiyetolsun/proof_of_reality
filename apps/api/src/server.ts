/**
 * Local-only Express server. Skips Vercel entirely so you can `pnpm dev`
 * without logging into the Vercel CLI.
 *
 * Usage:
 *   cd apps/api && pnpm dev   (uses tsx watch — auto-restarts on file changes)
 *
 * Listens on PORT (env, default 4000). The Next.js viewer wants 3000, so
 * we deliberately don't collide.
 */
try {
  process.loadEnvFile(".env");
} catch {
  // .env not present — env validation will surface a useful error
}

import os from "node:os";
import { execSync } from "node:child_process";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

app.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);
  console.log(`[api] health: http://localhost:${port}/health`);
  console.log(`[api] nonce:  POST http://localhost:${port}/api/nonce`);

  // Print URLs the iPhone (or any other LAN device) can use. Both the
  // Bonjour name (.local — survives IP/Wi-Fi changes) and the current
  // IPv4 LAN address. Spares you from hunting for the right baseURL
  // when DHCP rolls or you switch networks.
  const ifaces = os.networkInterfaces();
  const lan = Object.values(ifaces)
    .flat()
    .find((i) => i && i.family === "IPv4" && !i.internal)?.address;
  let bonjour: string | null = null;
  try {
    bonjour = execSync("scutil --get LocalHostName", { encoding: "utf8" }).trim();
  } catch {}

  console.log("");
  console.log("[api] iOS Secrets.swift baseURL options:");
  if (bonjour) console.log(`        http://${bonjour}.local:${port}   ← preferred (survives IP changes)`);
  if (lan) console.log(`        http://${lan}:${port}        ← current LAN IP`);
});
