"""Capture loop entry point.

Flow:
    1. Wait for trigger (button / motion / REST)
    2. Fetch cosmic nonce from backend (POST /api/nonce)
    3. Render nonce as QR on the kiosk display
    4. Capture stereo + RGB sequence with DepthAI v3
    5. Export point cloud / glb
    6. Build ProofBundle
    7. Sign deviceSigningHash with USB Armory (HTTP)
    8. POST /api/upload (multipart: scene + bundle)
    9. POST /api/mint with returned refs + cosmoSig
   10. Show success QR on kiosk + open viewer URL
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

from .attest import make_signer
from .net.client import ProofApiClient
from .pipeline.capture import CaptureSession
from .recon.export import export_scene
from .canonical import bundle_for_signing, finalize_bundle
from .kiosk.display import KioskDisplay


def main() -> int:
    api = ProofApiClient(
        base_url=os.environ["PROOF_API_URL"],
        token=os.environ["PROOF_API_TOKEN"],
    )
    signer = make_signer(os.environ.get("ATTEST_BACKEND", "armory"))
    kiosk = KioskDisplay(mode=os.environ.get("KIOSK_DISPLAY", "none"))

    print("[agent] ready. press button or send trigger…", flush=True)

    while True:
        kiosk.wait_for_trigger()

        # 1. Cosmic nonce from backend
        nonce = api.get_nonce()
        kiosk.show_qr(nonce.value)

        # 2. Capture
        capture_dir = Path(f"/tmp/captures/{int(time.time())}")
        capture_dir.mkdir(parents=True, exist_ok=True)
        session = CaptureSession(duration_sec=int(os.environ.get("CAPTURE_DURATION_SEC", "8")))
        session.run(capture_dir)

        # 3. Reconstruct
        scene_path = export_scene(capture_dir, output=capture_dir / "scene.glb")

        # 4. Build bundle (without spaceFabric — backend fills it)
        org_addr = os.environ["ORG_ATTESTOR_ADDR"]
        device_addr = signer.address()
        bundle = bundle_for_signing(
            nonce=nonce,
            scene_path=scene_path,
            session=session,
            device_addr=device_addr,
            org_addr=org_addr,
            vendor=signer.vendor,
        )

        # 5. Device sig over deviceSigningHash
        signing_hash = bundle.device_signing_hash()
        device_sig = signer.sign(signing_hash)
        bundle.attach_device_sig(device_sig)

        # 6. Upload + mint
        upload_res = api.upload(scene_path=scene_path, bundle_json=bundle.to_json())
        mint_res = api.mint(
            to=org_addr,
            bundle_hash=upload_res.bundle_hash,
            swarm_ref=upload_res.swarm_ref,
            bundle_ref=upload_res.bundle_ref,
            sat_sig=nonce.sat_sig.value,
            cosmo_sig=upload_res.cosmo_sig or "0x",
            attestation=device_sig,
            attestation_type=1,  # deviceSE
            attestor=org_addr,
            captured_at=session.started_at,
            mode=2,  # stereoFusion
        )

        kiosk.show_success(mint_res.explorer_url)
        print(f"[agent] minted: {mint_res.tx_hash}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
