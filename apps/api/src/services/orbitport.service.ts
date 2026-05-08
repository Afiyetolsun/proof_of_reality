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
 * Requires KMS_COSIGNER_KEY_ID to be set (created once via the setup script
 * at apps/api/scripts/create-kms-key.ts). On failure we return null and let
 * /api/upload embed an empty cosmoSig with spaceFabric.experimental=true —
 * the viewer's verifyCosmoSig tolerates this.
 */
export async function cosignBundle(bundleHashHex: `0x${string}`): Promise<`0x${string}` | null> {
  const keyId = env().KMS_COSIGNER_KEY_ID;
  if (!keyId) {
    console.warn("[orbitport] KMS_COSIGNER_KEY_ID not set; skipping cosign");
    return null;
  }
  try {
    const r = await sdk().kms.sign({
      keyId,
      message: bundleHashHex,
      // Our KMS key is created in the ETHEREUM scheme (ECC_SECG_P256K1) so we
      // can pin its uncompressed pubkey in the viewer and verify with noble's
      // secp256k1 directly — no GetPublicKey RPC needed (Orbitport doesn't
      // expose one).
      signingAlgorithm: "ETHEREUM_SECP256K1",
      messageType: "DIGEST",
    });
    const sig = (r.data as { Signature?: string }).Signature;
    if (!sig) return null;
    return ("0x" + sig.replace(/^0x/, "")) as `0x${string}`;
  } catch (e) {
    console.warn("[orbitport] cosign failed:", (e as Error).message);
    return null;
  }
}
