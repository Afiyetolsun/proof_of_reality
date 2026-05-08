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
  if (env().LOG_LEVEL === "debug" || process.env.ORBITPORT_DEBUG) {
    _sdk.setDebug(true);
  }
  return _sdk;
}

export interface CosmicNonce {
  value: `0x${string}`;
  /** Reflects what cTRNG returned: "trng" / "rng" / "ipfs" / "derived" / etc. */
  src: string;
  /** Null when the satellite isn't currently in coverage and cTRNG returned a derived value. */
  satSig: { value: `0x${string}`; pk: `0x${string}` } | null;
  issuedAt: number;
  provider?: string;
}

/** Fetch a fresh cosmic random + (when available) satellite signature. */
export async function getCosmicNonce(): Promise<CosmicNonce> {
  const r = await sdk().ctrng.random();
  const d = r.data;
  return {
    value: ("0x" + d.data.replace(/^0x/, "")) as `0x${string}`,
    src: d.src,
    satSig: d.signature
      ? {
          value: ("0x" + d.signature.value.replace(/^0x/, "")) as `0x${string}`,
          pk: ("0x" + d.signature.pk.replace(/^0x/, "")) as `0x${string}`,
        }
      : null,
    issuedAt: d.timestamp
      ? Math.floor(new Date(d.timestamp).getTime() / 1000)
      : Math.floor(Date.now() / 1000),
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
  // KMS DIGEST mode requires the message to be exactly 32 raw bytes — pass as
  // Uint8Array (the SDK base64-encodes on the wire). Passing the 0x-prefixed
  // hex string would be sent as 66 ASCII bytes and rejected.
  const clean = bundleHashHex.startsWith("0x") ? bundleHashHex.slice(2) : bundleHashHex;
  const messageBytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < messageBytes.length; i++) {
    messageBytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  try {
    const r = await sdk().kms.sign({
      keyId,
      message: messageBytes,
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
