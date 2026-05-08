"""Python mirror of @proof-of-reality/proof-bundle's canonicalize + bundleHash.

CRITICAL: this MUST produce byte-for-byte identical output to the TypeScript
implementation in `packages/proof-bundle/src/canonical.ts`. CI gates this with
a shared fixture. If you change one, change the other.
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from Crypto.Hash import keccak


def canonicalize(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if not (value == value) or value in (float("inf"), float("-inf")):
            raise ValueError("non-finite numbers not allowed")
        return json.dumps(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, list):
        return "[" + ",".join(canonicalize(v) for v in value) + "]"
    if isinstance(value, dict):
        keys = sorted(k for k, v in value.items() if v is not None)
        parts = []
        for k in keys:
            parts.append(json.dumps(k, ensure_ascii=False) + ":" + canonicalize(value[k]))
        return "{" + ",".join(parts) + "}"
    raise TypeError(f"canonicalize: unsupported type {type(value).__name__}")


def keccak256(data: bytes) -> bytes:
    h = keccak.new(digest_bits=256)
    h.update(data)
    return h.digest()


def hash_canonical(value: Any) -> str:
    canon = canonicalize(value)
    return "0x" + keccak256(canon.encode("utf-8")).hex()


@dataclass
class CosmicNonce:
    value: str
    src: str
    sat_sig: "SatSig"
    issued_at: int


@dataclass
class SatSig:
    value: str
    pk: str


@dataclass
class ProofBundle:
    """Mirror of the TS schema. Build incrementally; serialize at the end."""

    version: str = "1.0"
    mode: str = "stereoFusion"
    device: dict[str, Any] = field(default_factory=dict)
    capture: dict[str, Any] = field(default_factory=dict)
    nonce: dict[str, Any] = field(default_factory=dict)
    space_fabric: dict[str, Any] = field(default_factory=lambda: {
        "cosmoSig": None, "kmsPk": None, "kmsKeyId": None, "experimental": True,
    })
    sensors: dict[str, Any] = field(default_factory=dict)
    attestation: dict[str, Any] = field(default_factory=dict)

    def device_signing_hash(self) -> str:
        """Hash of bundle MINUS the spaceFabric block — what the device key signs."""
        d = self._to_dict()
        d.pop("spaceFabric", None)
        return hash_canonical(d)

    def attach_device_sig(self, sig_hex: str) -> None:
        if self.attestation.get("type") != "deviceSE":
            raise ValueError("attach_device_sig requires deviceSE attestation type")
        self.attestation["deviceSE"]["deviceSig"] = sig_hex

    def to_json(self) -> bytes:
        return canonicalize(self._to_dict()).encode("utf-8")

    def _to_dict(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "mode": self.mode,
            "device": self.device,
            "capture": self.capture,
            "nonce": self.nonce,
            "spaceFabric": self.space_fabric,
            "sensors": self.sensors,
            "attestation": self.attestation,
        }


def bundle_for_signing(
    *,
    nonce: CosmicNonce,
    scene_path: Path,
    session: Any,
    device_addr: str,
    org_addr: str,
    vendor: str,
) -> ProofBundle:
    """Build a ProofBundle ready for device signing (no cosmoSig yet)."""
    bundle = ProofBundle()
    bundle.device = {
        "model": "OAK-4-D",
        "os": "luxonis-os/5.15",
        "appVersion": "0.1.0",
    }
    bundle.capture = {
        "startedAt": session.started_at,
        "endedAt": session.ended_at,
        "frames": session.frame_count,
        "sceneFormat": "glb",
    }
    bundle.nonce = {
        "value": nonce.value,
        "src": nonce.src,
        "satSig": {"value": nonce.sat_sig.value, "pk": nonce.sat_sig.pk},
        "issuedAt": nonce.issued_at,
        "binding": ["visualQR"],
    }
    bundle.sensors = {"imu": "inline-base64-stub"}
    bundle.attestation = {
        "type": "deviceSE",
        "deviceSE": {
            "deviceAddr": device_addr,
            "deviceSig": "0x",  # filled by attach_device_sig
            "vendor": vendor,
        },
    }
    return bundle


def finalize_bundle(bundle: ProofBundle, *, cosmo_sig: str | None, kms_pk: str | None, kms_key_id: str | None) -> ProofBundle:
    bundle.space_fabric = {
        "cosmoSig": cosmo_sig,
        "kmsPk": kms_pk,
        "kmsKeyId": kms_key_id,
        "experimental": True,
    }
    return bundle
