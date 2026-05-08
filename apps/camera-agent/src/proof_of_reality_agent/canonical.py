"""ProofBundle construction + canonical SHA-256 hash for the B2B path.

Bundle shape MUST match voxelio_web3/Core/ProofSession/ProofBundle.swift —
that's what the backend hashes on /api/upload, and the on-chain bundleHash
is `sha256(canonicalJSON(bundle))`. Drift here breaks every proof.

Canonicalization mirrors iOS's `JSONEncoder.sortedKeys + withoutEscapingSlashes`:
  - object keys sorted lexicographically (recursively)
  - arrays preserve order
  - no insignificant whitespace
  - no escaped slashes (Swift's withoutEscapingSlashes behaviour)

Tested: cross-language fixture parity is asserted by smoke-mint.ts on the
backend side — both languages must hash the same bundle to the same digest.
"""
from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Canonical encoding
# ---------------------------------------------------------------------------

def canonical_json(value: Any) -> str:
    """Produce the same bytes that Swift's JSONEncoder.sortedKeys does for our
    ProofBundle shape."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if not (value == value) or value in (float("inf"), float("-inf")):
            raise ValueError("non-finite numbers not allowed in bundle")
        # Match Swift's default Double encoding
        return json.dumps(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, list):
        return "[" + ",".join(canonical_json(v) for v in value) + "]"
    if isinstance(value, dict):
        keys = sorted(k for k, v in value.items())
        parts = [json.dumps(k, ensure_ascii=False) + ":" + canonical_json(value[k]) for k in keys]
        return "{" + ",".join(parts) + "}"
    raise TypeError(f"canonical_json: unsupported type {type(value).__name__}")


def sha256_hex(data: bytes) -> str:
    """Lowercase hex digest, no 0x prefix (matches iOS ProofHasher.sha256)."""
    return hashlib.sha256(data).hexdigest()


def bundle_hash_hex(bundle: dict[str, Any]) -> str:
    """0x-prefixed SHA-256 of canonical bundle JSON (what gets minted on-chain)."""
    return "0x" + sha256_hex(canonical_json(bundle).encode("utf-8"))


# ---------------------------------------------------------------------------
# ProofBundle dataclasses (mirror iOS shape)
# ---------------------------------------------------------------------------

@dataclass
class FileRef:
    name: str
    sha256: str
    bytes: int


@dataclass
class DeviceInfo:
    model: str
    osVersion: str
    bundleId: str


@dataclass
class CosmicNonce:
    """Whatever /api/nonce returned — we pass-through into the bundle."""
    value: str           # hex string
    sat_sig: str         # may be ""
    sat_pk: str | None   # informational; not in bundle JSON
    src: str             # informational
    expires_at: int


@dataclass
class CaptureSession:
    """Bookkeeping for the capture pipeline (DepthAI etc.)."""
    started_at: int = 0
    ended_at: int = 0
    frame_count: int = 0


@dataclass
class ProofBundle:
    """
    iOS-equivalent shape. Field names + ordering chosen to hash byte-identically
    to voxelio_web3 ProofBundle.swift.
    """
    version: int
    mode: str               # "stereoFusion" | "objectCapture" | "roomPlan"
    createdAt: int
    nonce: str              # cTRNG value
    satSig: str             # may be "" when satellite is out of coverage
    nonceExpiresAt: int
    scene: FileRef
    audio: FileRef | None
    sensorsHash: str        # sha256 of an opaque sensor blob
    device: DeviceInfo

    def to_canonical_dict(self) -> dict[str, Any]:
        d = asdict(self)
        # asdict() produces { audio: None } when None; keep that — both
        # canonical_json and Swift's encoder emit `null` for it, so the
        # cross-language hash stays consistent.
        return d

    def hash_hex(self) -> str:
        return bundle_hash_hex(self.to_canonical_dict())

    def canonical_bytes(self) -> bytes:
        return canonical_json(self.to_canonical_dict()).encode("utf-8")


# ---------------------------------------------------------------------------
# Bundle builder
# ---------------------------------------------------------------------------

def build_bundle(
    *,
    nonce: CosmicNonce,
    scene_path: Path,
    audio_path: Path | None,
    session: CaptureSession,
    device_model: str = "OAK-4-D",
    device_os: str = "luxonis-os/5.15",
    bundle_id: str = "io.voxelio.b2b.camera",
    mode: str = "stereoFusion",
) -> ProofBundle:
    """Build a fresh ProofBundle. Hashes scene (and audio if present) to fill
    the FileRef SHA-256s; computes a sensorsHash placeholder."""
    scene_bytes = scene_path.read_bytes()
    scene_ref = FileRef(name=scene_path.name, sha256=sha256_hex(scene_bytes), bytes=len(scene_bytes))

    audio_ref: FileRef | None = None
    if audio_path is not None and audio_path.exists():
        audio_bytes = audio_path.read_bytes()
        audio_ref = FileRef(name=audio_path.name, sha256=sha256_hex(audio_bytes), bytes=len(audio_bytes))

    sensors_blob = f"frames={session.frame_count};started={session.started_at};ended={session.ended_at}"
    sensors_hash = sha256_hex(sensors_blob.encode("utf-8"))

    return ProofBundle(
        version=1,
        mode=mode,
        createdAt=session.started_at or int(time.time()),
        nonce=nonce.value,
        satSig=nonce.sat_sig,
        nonceExpiresAt=nonce.expires_at,
        scene=scene_ref,
        audio=audio_ref,
        sensorsHash=sensors_hash,
        device=DeviceInfo(model=device_model, osVersion=device_os, bundleId=bundle_id),
    )
