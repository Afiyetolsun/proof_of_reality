/**
 * USDZ → GLB conversion service.
 *
 * Usage: GET /convert?ref=<bzz-hex>[&proto=bzz]
 *
 * Flow:
 *   1. Look up the ref in the persistent cache (data/cache.json). If we've
 *      already converted it, return the cached GLB ref immediately.
 *   2. Otherwise: fetch the USDZ from the local Bee node → run Blender
 *      headless to convert USDZ → GLB → upload the GLB back to Bee with
 *      our postage stamp → cache the mapping → return the new ref.
 *
 * Idempotent: same input ref always yields the same output ref (Swarm
 * is content-addressed, and our cache prevents redundant Blender runs).
 *
 * Designed to live on the same VPS as Bee so the upstream fetch + the
 * upload both go through localhost — no public bandwidth cost for the
 * USDZ payload, only for the public-facing GET /convert response.
 */
import express from "express";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT ?? 8080);
const BEE_URL = (process.env.BEE_URL ?? "http://localhost:1633").replace(/\/$/, "");
const STAMP_ID = process.env.STAMP_ID;
const CACHE_FILE = process.env.CACHE_FILE ?? "/data/cache.json";
const HEX64 = /^[0-9a-fA-F]{64}$/;

if (!STAMP_ID) {
  console.error("FATAL: STAMP_ID env var not set — converter can't upload to Bee without it");
  process.exit(1);
}

// In-memory cache, persisted to disk on every write. Tiny JSON so this
// never gets large enough to matter; ~30 conversions per MB. Tracks
// per-ref state so concurrent requests for the same ref share a single
// running conversion instead of stampeding the GPU.
let cache = {}; // { [usdzRef]: { glbRef: string, convertedAt: number } }
const inflight = new Map(); // usdzRef -> Promise<string>

async function loadCache() {
  if (existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(await readFile(CACHE_FILE, "utf8"));
      console.log(`[cache] loaded ${Object.keys(cache).length} entries`);
    } catch (e) {
      console.warn(`[cache] couldn't read ${CACHE_FILE}: ${e.message}, starting fresh`);
    }
  }
}

async function saveCache() {
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

/** Streams the USDZ from Bee to a temp file. */
async function fetchToFile(ref, dest) {
  const res = await fetch(`${BEE_URL}/bzz/${ref}`, { redirect: "follow" });
  if (!res.ok) throw new Error(`bee /bzz returned ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return buf.length;
}

/** Posts the GLB back to Bee with our postage stamp; returns the ref. */
async function uploadGlb(filePath, filename) {
  const buf = await readFile(filePath);
  const url = `${BEE_URL}/bzz?name=${encodeURIComponent(filename)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "model/gltf-binary",
      "Swarm-Postage-Batch-Id": STAMP_ID,
    },
    body: buf,
  });
  if (!res.ok) {
    throw new Error(`bee upload failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  if (!json.reference) throw new Error("bee upload returned no reference");
  return json.reference;
}

/** Runs Blender headless. Resolves on exit code 0, rejects with stderr otherwise. */
function runBlender(usdzPath, glbPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "blender",
      ["--background", "--python", "/app/convert.py", "--", usdzPath, glbPath],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stderr = "";
    proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`blender exit ${code}\n${stderr.split("\n").slice(-15).join("\n")}`));
      }
    });
  });
}

/** End-to-end: ref → GLB ref. Caches; serializes concurrent requests for the same ref. */
async function convertOnce(usdzRef) {
  if (cache[usdzRef]) return cache[usdzRef].glbRef;
  if (inflight.has(usdzRef)) return inflight.get(usdzRef);

  const work = (async () => {
    const dir = join(tmpdir(), `convert-${randomUUID()}`);
    await mkdir(dir, { recursive: true });
    const usdzPath = join(dir, "scene.usdz");
    const glbPath = join(dir, "scene.glb");

    try {
      const fetchedBytes = await fetchToFile(usdzRef, usdzPath);
      console.log(`[convert] ${usdzRef.slice(0, 12)}… fetched ${fetchedBytes} B`);

      const t0 = Date.now();
      await runBlender(usdzPath, glbPath);
      console.log(`[convert] ${usdzRef.slice(0, 12)}… blender done in ${Date.now() - t0} ms`);

      const glbRef = await uploadGlb(glbPath, "scene.glb");
      console.log(`[convert] ${usdzRef.slice(0, 12)}… → ${glbRef.slice(0, 12)}…`);

      cache[usdzRef] = { glbRef, convertedAt: Date.now() };
      saveCache().catch((e) => console.warn(`[cache] save failed: ${e.message}`));
      return glbRef;
    } finally {
      // Best-effort cleanup
      await Promise.all([
        unlink(usdzPath).catch(() => {}),
        unlink(glbPath).catch(() => {}),
      ]);
    }
  })();

  inflight.set(usdzRef, work);
  try {
    return await work;
  } finally {
    inflight.delete(usdzRef);
  }
}

const app = express();

app.get("/health", (_req, res) => {
  res.json({ ok: true, cached: Object.keys(cache).length });
});

app.get("/convert", async (req, res) => {
  const ref = String(req.query.ref ?? "").toLowerCase().trim();
  const proto = req.query.proto ?? "bzz";

  if (!HEX64.test(ref)) {
    return res.status(400).json({ error: "ref must be 64-hex (Swarm reference)" });
  }
  if (proto !== "bzz") {
    return res.status(400).json({ error: "only proto=bzz supported" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

  try {
    const glbRef = await convertOnce(ref);
    res.json({ glbRef, sourceRef: ref });
  } catch (e) {
    console.error(`[convert] ${ref.slice(0, 12)}… failed: ${e.message}`);
    res.status(502).json({ error: e.message, sourceRef: ref });
  }
});

app.options("/convert", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.status(204).end();
});

await loadCache();
app.listen(PORT, () => {
  console.log(`[converter] listening on :${PORT}`);
  console.log(`[converter] bee     ${BEE_URL}`);
  console.log(`[converter] stamp   ${STAMP_ID.slice(0, 12)}…`);
  console.log(`[converter] cache   ${CACHE_FILE}`);
});
