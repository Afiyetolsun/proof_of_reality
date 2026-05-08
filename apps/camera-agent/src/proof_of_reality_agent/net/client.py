"""Backend HTTP client (matches the iOS wire protocol).

Auth via X-Voxelio-Key. Routes:
  POST /api/nonce  -> { nonce, satSig, expiresAt, satPk, src, ... }
  POST /api/upload -> { swarmRef, bundleHash, bundleRef?, cosmoSig?, ... }
  POST /api/mint   -> { txHash, tokenId, ensName, stub, explorerUrl }
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import httpx

from ..canonical import CosmicNonce


@dataclass
class UploadResult:
    swarm_ref: str          # iOS-canonical: scene Pinata/Swarm ref
    bundle_hash: str        # 0x + 64 hex
    bundle_ref: str | None  # backend-pinned bundle JSON ref (additive)
    cosmo_sig: str | None   # KMS co-signature (additive)


@dataclass
class MintResult:
    tx_hash: str
    token_id: str
    explorer_url: str
    ens_name: str | None
    stub: bool


class ProofApiClient:
    def __init__(self, *, base_url: str, token: str, timeout: float = 30.0) -> None:
        self.base_url = base_url.rstrip("/")
        self._client = httpx.Client(
            timeout=timeout,
            headers={"X-Voxelio-Key": token},
        )

    def get_nonce(self) -> CosmicNonce:
        r = self._client.post(f"{self.base_url}/api/nonce")
        r.raise_for_status()
        d = r.json()
        return CosmicNonce(
            value=d["nonce"],
            sat_sig=d.get("satSig", "") or "",
            sat_pk=d.get("satPk") or None,
            src=d.get("src", "unknown"),
            expires_at=int(d.get("expiresAt", 0)),
        )

    def upload(
        self,
        *,
        bundle_bytes: bytes,
        scene_path: Path,
        audio_path: Path | None = None,
    ) -> UploadResult:
        files = {
            "bundle": ("bundle.json", bundle_bytes, "application/json"),
            "scene": (scene_path.name, scene_path.read_bytes(), "application/octet-stream"),
        }
        if audio_path is not None and audio_path.exists():
            files["audio"] = (audio_path.name, audio_path.read_bytes(), "audio/m4a")

        r = self._client.post(f"{self.base_url}/api/upload", files=files)
        r.raise_for_status()
        d = r.json()
        return UploadResult(
            swarm_ref=d["swarmRef"],
            bundle_hash=d["bundleHash"],
            bundle_ref=d.get("bundleRef"),
            cosmo_sig=d.get("cosmoSig"),
        )

    def mint(
        self,
        *,
        swarm_ref: str,
        bundle_ref: str,
        bundle_hash: str,
        sat_sig: str,
        cosmo_sig: str,
        attestation: str,        # hex (deviceSE) or base64 (appAttest)
        attestation_type: int,   # 0=appAttest, 1=deviceSE
        attestor: str | None,
        captured_at: int,
        mode: int,               # 0=roomPlan, 1=objectCapture, 2=stereoFusion
        recipient: str | None = None,
    ) -> MintResult:
        body: dict[str, object] = {
            "swarmRef": swarm_ref,
            "bundleRef": bundle_ref,
            "bundleHash": bundle_hash,
            "satSig": sat_sig or "STUB",
            "cosmoSig": cosmo_sig or "",
            "attestation": attestation or "MOCK",
            "attestationType": attestation_type,
            "capturedAt": captured_at,
            "mode": mode,
        }
        if attestor:
            body["attestor"] = attestor
        if recipient:
            body["recipient"] = recipient

        r = self._client.post(
            f"{self.base_url}/api/mint",
            json=body,
            headers={"Content-Type": "application/json"},
        )
        r.raise_for_status()
        d = r.json()
        return MintResult(
            tx_hash=d["txHash"],
            token_id=d.get("tokenId", "0"),
            explorer_url=d.get("explorerUrl", ""),
            ens_name=d.get("ensName"),
            stub=bool(d.get("stub", False)),
        )
