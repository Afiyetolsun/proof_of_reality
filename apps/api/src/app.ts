import express, { type Express } from "express";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { authMiddleware } from "./middleware/auth.middleware.js";
import { nonceRouter } from "./routes/nonce.routes.js";
import { uploadRouter } from "./routes/upload.routes.js";
import { mintRouter } from "./routes/mint.routes.js";
import { deviceRouter } from "./routes/device.routes.js";

export function createApp(): Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_req, res) => res.json({ ok: true, name: "proof-of-reality-api" }));
  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api", authMiddleware);
  app.use("/api/nonce", nonceRouter);
  app.use("/api/upload", uploadRouter);
  app.use("/api/mint", mintRouter);
  app.use("/api/device", deviceRouter);

  app.use(errorMiddleware);
  return app;
}
