import { OrbitportSDK } from "@spacecomputer-io/orbitport-sdk-ts";
import { env } from "../config/env.js";

let _sdk: OrbitportSDK | null = null;

function sdk(): OrbitportSDK {
  if (_sdk) return _sdk;
  _sdk = new OrbitportSDK({
    config: {
      clientId: env().ORBITPORT_CLIENT_ID,
      clientSecret: env().ORBITPORT_CLIENT_SECRET,
    },
  });
  return _sdk;
}

export interface CosmicNonce {
  value: `0x${string}`;
  src: "trng" | "rng" | "ipfs";
  satSig: { value: `0x${string}`; pk: `0x${string}` };
  issuedAt: number;
  provider?: string;
}

/** Fetch a fresh cosmic random + satellite signature. Used by /api/nonce. */
export async function getCosmicNonce(): Promise<CosmicNonce> {
  const r = await sdk().ctrng.random();
  const d = r.data;
  if (!d.signature) {
    // IPFS-beacon source has no per-call signature (signed at beacon publish time).
    // For B2C/B2B capture flow we want the API source.
    throw new Error(`cTRNG returned no signature (src=${d.src})`);
  }
  return {
    value: ("0x" + d.data.replace(/^0x/, "")) as `0x${string}`,
    src: d.src as "trng" | "rng" | "ipfs",
    satSig: {
      value: ("0x" + d.signature.value.replace(/^0x/, "")) as `0x${string}`,
      pk: ("0x" + d.signature.pk.replace(/^0x/, "")) as `0x${string}`,
    },
    issuedAt: d.timestamp ? Math.floor(new Date(d.timestamp).getTime() / 1000) : Math.floor(Date.now() / 1000),
    provider: d.provider,
  };
}

/**
 * Co-sign a 32-byte bundle hash with the SpaceComputer KMS.
 *
 * NOTE: @spacecomputer-io/orbitport-sdk-ts@0.1.0 (currently published on npm)
 * exposes only ctrng + auth. KMS exists in their docs site as JSON-RPC at
 *   POST {ORBITPORT_API_URL}/api/v1/rpc
 * but isn't surfaced through the SDK yet. To wire it without the SDK:
 *
 *   const token = await sdk().auth.getValidToken();
 *   const r = await fetch(`${env().ORBITPORT_API_URL}/api/v1/rpc`, {
 *     method: "POST",
 *     headers: {
 *       Authorization: `Bearer ${token}`,
 *       "Content-Type": "application/json",
 *     },
 *     body: JSON.stringify({
 *       jsonrpc: "2.0", id: Date.now(),
 *       method: "kms.sign",  // exact method name TBD — confirm at booth
 *       params: { keyId, message: bundleHashHex,
 *                 signingAlgorithm: "ECDSA_SHA_256", messageType: "DIGEST" },
 *     }),
 *   });
 *
 * For the hackathon: degrade gracefully. The bundle's spaceFabric.experimental
 * flag is true; the viewer's verifyCosmoSig tolerates a null cosmoSig. The
 * cTRNG path remains the primary SpaceComputer integration for the bounty.
 */
export async function cosignBundle(_bundleHashHex: `0x${string}`): Promise<`0x${string}` | null> {
  return null;
}
