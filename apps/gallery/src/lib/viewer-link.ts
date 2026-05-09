const ENS_APP_BASE =
  process.env.NEXT_PUBLIC_ENS_APP_BASE_URL ?? "https://sepolia.app.ens.domains";
const SWARM_GATEWAY =
  process.env.NEXT_PUBLIC_SWARM_GATEWAY ?? "https://api.gateway.ethswarm.org";
const PARENT_NAME = process.env.NEXT_PUBLIC_ENS_PARENT_NAME ?? "realityproof.eth";

export const ensParentName = PARENT_NAME;
export const ensAppParentUrl = `${ENS_APP_BASE}/${PARENT_NAME}?tab=subnames`;

/** Same-origin link to the gallery's per-name detail page. */
export function viewerForName(name: string): string {
  return `/${encodeURIComponent(name)}`;
}

export function ensAppForName(name: string): string {
  return `${ENS_APP_BASE}/${encodeURIComponent(name)}`;
}

export function swarmGatewayUrl(ref: string): string {
  return `${SWARM_GATEWAY.replace(/\/$/, "")}/bzz/${ref}`;
}

export function ipfsGatewayUrl(ref: string): string {
  return `https://gateway.pinata.cloud/ipfs/${ref}`;
}

export function contentDirectUrl(content: { protocol: "bzz" | "ipfs"; ref: string }): string {
  return content.protocol === "bzz" ? swarmGatewayUrl(content.ref) : ipfsGatewayUrl(content.ref);
}
