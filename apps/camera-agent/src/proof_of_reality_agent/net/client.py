"""Backend HTTP client."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import httpx

from ..canonical import CosmicNonce, SatSig


@dataclass
class UploadResult:
    swarm_ref: str
    bundle_ref: str
    bundle_hash: str
    cosmo_sig: str | None


@dataclass
class MintResult:
    tx_hash: str
    explorer_url: str


class ProofApiClient:
    def __init__(self, *, base_url: str, token: str, timeout: float = 30.0) -> None:
        self.base_url = base_url.rstrip("/")
        self._client = httpx.Client(
            timeout=timeout,
            headers={"Authorization": f"Bearer {token}"},
        )

    def get_nonce(self) -> CosmicNonce:
        r = self._client.post(f"{self.base_url}/api/nonce")
        r.raise_for_status()
        d = r.json()
        return CosmicNonce(
            value=d["value"],
            src=d["src"],
            sat_sig=SatSig(value=d["satSig"]["value"], pk=d["satSig"]["pk"]),
            issued_at=d["issuedAt"],
        )

    def upload(self, *, scene_path: Path, bundle_json: bytes) -> UploadResult:
        files = {
            "scene": (scene_path.name, scene_path.read_bytes(), "application/octet-stream"),
            "bundle": ("bundle.json", bundle_json, "application/json"),
        }
        r = self._client.post(f"{self.base_url}/api/upload", files=files)
        r.raise_for_status()
        d = r.json()
        return UploadResult(
            swarm_ref=d["swarmRef"],
            bundle_ref=d["bundleRef"],
            bundle_hash=d["bundleHash"],
            cosmo_sig=d.get("cosmoSig"),
        )

    def mint(
        self,
        *,
        to: str,
        bundle_hash: str,
        swarm_ref: str,
        bundle_ref: str,
        sat_sig: str,
        cosmo_sig: str,
        attestation: str,
        attestation_type: int,
        attestor: str,
        captured_at: int,
        mode: int,
    ) -> MintResult:
        r = self._client.post(
            f"{self.base_url}/api/mint",
            json={
                "to": to,
                "bundleHash": bundle_hash,
                "swarmRef": swarm_ref,
                "bundleRef": bundle_ref,
                "satSig": sat_sig,
                "cosmoSig": cosmo_sig,
                "attestation": attestation,
                "attestationType": attestation_type,
                "attestor": attestor,
                "capturedAt": str(captured_at),
                "mode": mode,
            },
        )
        r.raise_for_status()
        d = r.json()
        return MintResult(tx_hash=d["txHash"], explorer_url=d["explorerUrl"])
