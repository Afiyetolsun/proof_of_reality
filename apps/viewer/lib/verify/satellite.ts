import type { Nonce } from "@proof-of-reality/proof-bundle";

const SAT_PUBKEY = process.env.NEXT_PUBLIC_SAT_PUBKEY;

/**
 * Verify the SpaceComputer satellite signature over the cosmic nonce.
 *
 * The cTRNG response gives us `signature.value` and `signature.pk`. For verification
 * independence, we additionally compare `pk` to a pinned `NEXT_PUBLIC_SAT_PUBKEY`
 * (set once we know which satellite key to trust).
 *
 * Stub: real verification requires knowing the satellite's signing curve. Document
 * once we have a confirmed cTRNG response from the booth.
 */
export async function verifySatSig(nonce: Nonce): Promise<{ ok: boolean; detail: string }> {
  const satSig = nonce.satSig;
  if (!satSig?.value || !satSig?.pk) {
    return { ok: false, detail: "missing satSig" };
  }
  if (SAT_PUBKEY && SAT_PUBKEY.toLowerCase() !== satSig.pk.toLowerCase()) {
    return { ok: false, detail: "satellite pubkey does not match pinned value" };
  }
  // TODO: real curve verification once we know the algo (likely Ed25519 or P-256).
  return { ok: true, detail: `pk=${satSig.pk.slice(0, 12)}…` };
}
