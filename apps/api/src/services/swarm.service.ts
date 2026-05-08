import { env } from "../config/env.js";

export interface SwarmUploadResult {
  reference: string;
  sizeBytes: number;
}

export async function uploadToSwarm(payload: Uint8Array): Promise<SwarmUploadResult> {
  const e = env();
  if (e.STORAGE_BACKEND === "ipfs") {
    return uploadToPinata(payload);
  }
  if (!e.SWARM_POSTAGE_BATCH_ID) {
    throw new Error("SWARM_POSTAGE_BATCH_ID not configured");
  }
  const res = await fetch(`${e.SWARM_BEE_URL.replace(/\/$/, "")}/bzz`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Swarm-Postage-Batch-Id": e.SWARM_POSTAGE_BATCH_ID,
    },
    body: payload,
  });
  if (!res.ok) {
    throw new Error(`swarm upload failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { reference: string };
  return { reference: json.reference, sizeBytes: payload.byteLength };
}

async function uploadToPinata(payload: Uint8Array): Promise<SwarmUploadResult> {
  const e = env();
  if (!e.PINATA_JWT) throw new Error("PINATA_JWT not set; cannot fall back to IPFS");
  const fd = new FormData();
  fd.append("file", new Blob([payload]), "scene.bin");
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${e.PINATA_JWT}` },
    body: fd,
  });
  if (!res.ok) throw new Error(`pinata upload failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { IpfsHash: string };
  return { reference: json.IpfsHash, sizeBytes: payload.byteLength };
}
