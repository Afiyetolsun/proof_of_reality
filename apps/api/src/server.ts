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

import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

app.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);
  console.log(`[api] health: http://localhost:${port}/health`);
  console.log(`[api] nonce:  POST http://localhost:${port}/api/nonce`);
});
