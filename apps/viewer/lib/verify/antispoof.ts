/**
 * Anti-spoof classifier — detects "scan of a screen / printed photo / 2D billboard".
 *
 * Stub for the hackathon. Real implementation runs a lightweight classifier on the
 * fused scene + a few view-angle frames, looking at depth-coherence, surface normals,
 * specular reflections, and parallax consistency.
 */
export async function runAntiSpoof(args: {
  swarmRef: string;
}): Promise<{ ok: boolean; detail: string }> {
  void args;
  return { ok: true, detail: "stub: classifier not wired yet" };
}
