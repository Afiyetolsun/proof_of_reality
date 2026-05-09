import { env } from "../config/env.js";

export interface SwarmUploadResult {
  reference: string;
  sizeBytes: number;
}

interface MinimalResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

/**
 * Uploads to Swarm or Pinata IPFS depending on STORAGE_BACKEND.
 *
 * filename + contentType: passed through to Bee so the gateway returns
 * the file with proper Content-Type + Content-Disposition headers when
 * fetched at /bzz/<ref>. Without them Bee stores the bytes as raw
 * octet-stream and the gateway hands you a nameless blob — browsers
 * download it as "download" with no extension and no app association.
 */
export async function uploadToSwarm(
  payload: Uint8Array,
  filename?: string,
  contentType?: string,
): Promise<SwarmUploadResult> {
  const e = env();
  if (e.STORAGE_BACKEND === "ipfs") {
    return uploadToPinata(payload, filename);
  }
  if (!e.SWARM_POSTAGE_BATCH_ID) {
    throw new Error("SWARM_POSTAGE_BATCH_ID not configured");
  }
  // ?name=<filename> tells Bee to wrap the upload in a single-file
  // manifest; fetching the resulting reference returns the file with
  // both Content-Type and Content-Disposition: attachment;filename=…
  const base = e.SWARM_BEE_URL.replace(/\/$/, "");
  const url = filename
    ? `${base}/bzz?name=${encodeURIComponent(filename)}`
    : `${base}/bzz`;
  const res = (await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": contentType ?? "application/octet-stream",
      "Swarm-Postage-Batch-Id": e.SWARM_POSTAGE_BATCH_ID,
    },
    body: payload,
  })) as unknown as MinimalResponse;
  if (!res.ok) {
    throw new Error(`swarm upload failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { reference: string };
  return { reference: json.reference, sizeBytes: payload.byteLength };
}

async function uploadToPinata(payload: Uint8Array, filename?: string): Promise<SwarmUploadResult> {
  const e = env();
  if (!e.PINATA_JWT) throw new Error("PINATA_JWT not set; cannot fall back to IPFS");
  const fd = new FormData();
  fd.append("file", new Blob([payload]), filename ?? "scene.bin");
  const res = (await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${e.PINATA_JWT}` },
    body: fd,
  })) as unknown as MinimalResponse;
  if (!res.ok) throw new Error(`pinata upload failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { IpfsHash: string };
  return { reference: json.IpfsHash, sizeBytes: payload.byteLength };
}
