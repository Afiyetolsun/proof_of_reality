"""B2B capture loop entry point.

End-to-end flow on every trigger:
    1. Wait for trigger (button / motion / REST / CLI enter)
    2. POST /api/nonce       → cosmic nonce + (when satellite is in coverage) satSig
    3. Render nonce as visible QR on the kiosk display
    4. Capture stereo + RGB sequence with DepthAI v3 (or stub for dev)
    5. Reconstruct + export scene as .glb
    6. Build ProofBundle (iOS-shape — backend hashes opaque bytes via SHA-256)
    7. Sign SHA-256(canonicalJSON(bundle)) with the USB Armory (or mock signer)
    8. POST /api/upload      → backend pins to Pinata/Swarm + KMS-cosigns
    9. POST /api/mint        → contract emits RealityMinted, backend returns tokenId
   10. Show success URL on kiosk

Run with `ATTEST_BACKEND=mock` for laptop dev (no USB Armory required).
Run with `ATTEST_BACKEND=armory` against a flashed USB Armory Mk II.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path


def _load_dotenv(path: Path) -> None:
    """Tiny .env loader so we don't pull in python-dotenv for ~5 keys."""
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv(Path(".env"))

from .attest import make_signer  # noqa: E402
from .canonical import CaptureSession, build_bundle  # noqa: E402
from .kiosk.display import KioskDisplay  # noqa: E402
from .net.client import ProofApiClient  # noqa: E402
from .pipeline.capture import CaptureSession as PipelineSession  # noqa: E402
from .recon.export import export_scene  # noqa: E402


def _required_env(key: str) -> str:
    v = os.environ.get(key)
    if not v:
        print(f"[agent] missing env var: {key}", file=sys.stderr)
        sys.exit(1)
    return v


def main() -> int:
    api = ProofApiClient(
        base_url=_required_env("PROOF_API_URL"),
        token=_required_env("PROOF_API_TOKEN"),
    )
    signer = make_signer(os.environ.get("ATTEST_BACKEND", "mock"))
    kiosk = KioskDisplay(mode=os.environ.get("KIOSK_DISPLAY", "none"))
    org_addr = _required_env("ORG_ATTESTOR_ADDR")
    duration = int(os.environ.get("CAPTURE_DURATION_SEC", "8"))

    print(f"[agent] device addr:  {signer.address()}")
    print(f"[agent] org attestor: {org_addr}")
    print(f"[agent] backend:      {api.base_url}")
    print("[agent] ready. press button or send trigger…", flush=True)

    while True:
        kiosk.wait_for_trigger()
        captured_at = int(time.time())

        # --- 1. cosmic nonce ---
        print("[agent] → /api/nonce")
        nonce = api.get_nonce()
        kiosk.show_qr(nonce.value)
        print(f"[agent]   nonce={nonce.value[:18]}…  src={nonce.src}  satSig={'✓' if nonce.sat_sig else 'null'}")

        # --- 2. capture + reconstruct ---
        capture_dir = Path(f"/tmp/captures/{captured_at}")
        capture_dir.mkdir(parents=True, exist_ok=True)

        pipeline = PipelineSession(duration_sec=duration)
        pipeline.run(capture_dir)

        scene_path = export_scene(capture_dir, output=capture_dir / "scene.glb")

        session = CaptureSession(
            started_at=pipeline.started_at,
            ended_at=pipeline.ended_at,
            frame_count=pipeline.frame_count,
        )

        # --- 3. build + sign bundle ---
        bundle = build_bundle(
            nonce=nonce,
            scene_path=scene_path,
            audio_path=None,
            session=session,
        )
        bundle_bytes = bundle.canonical_bytes()
        bundle_hash = bundle.hash_hex()
        print(f"[agent]   bundleHash={bundle_hash[:18]}…")

        # USB Armory signs SHA-256(canonical(bundle)). Returns 0x + 130 hex (r||s||v).
        device_sig_hex = signer.sign(bundle_hash)
        print(f"[agent]   deviceSig={device_sig_hex[:18]}…")

        # --- 4. upload ---
        print("[agent] → /api/upload")
        upload = api.upload(bundle_bytes=bundle_bytes, scene_path=scene_path)
        if upload.bundle_hash.lower() != bundle_hash.lower():
            print(
                f"[agent] !! bundleHash mismatch: client={bundle_hash} server={upload.bundle_hash}",
                file=sys.stderr,
            )
            kiosk.show_failure("bundle hash mismatch (canonicalization drift)")
            continue
        print(f"[agent]   swarmRef={upload.swarm_ref[:16]}…  cosmoSig={'✓' if upload.cosmo_sig else 'null'}")

        # --- 5. mint ---
        print("[agent] → /api/mint")
        mint = api.mint(
            swarm_ref=upload.swarm_ref,
            bundle_ref=upload.bundle_ref or f"local:{bundle_hash[2:]}",
            bundle_hash=bundle_hash,
            sat_sig=nonce.sat_sig or "STUB",
            cosmo_sig=upload.cosmo_sig or "",
            attestation=device_sig_hex,
            attestation_type=1,        # deviceSE
            attestor=org_addr,
            captured_at=captured_at,
            mode=2,                    # stereoFusion
            recipient=org_addr,        # B2B: NFT goes to the org wallet
        )
        kiosk.show_success(mint.explorer_url)
        print(f"[agent] ✅ minted token #{mint.token_id}: {mint.explorer_url}")


if __name__ == "__main__":
    sys.exit(main() or 0)
