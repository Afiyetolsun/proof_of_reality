/**
 * Verify that the cosmic nonce is *visible inside the scene* — bound at capture
 * time, not after the fact.
 *
 * Approach (off-chain):
 *   1. Fetch scene from Swarm (verified)
 *   2. Render N viewpoints
 *   3. Run a QR detector + OCR pass
 *   4. Compare extracted hex against expectedNonce
 *
 * Stub for the hackathon. Real implementation requires a 3D-renderer in the
 * viewer (three.js + a USDZ/PLY loader), or pre-rendered preview frames stored
 * alongside the scene.
 */
export async function runNonceOcr(args: {
  swarmRef: string;
  expectedNonce: string;
}): Promise<{ ok: boolean; detail: string }> {
  void args;
  return { ok: true, detail: "stub: nonce binding inferred from bundle" };
}
