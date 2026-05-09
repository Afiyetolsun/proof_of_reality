"""HTTP client for the proof-of-reality backend.

Three endpoints, all gated by `X-Camera-Key` (paired with the backend's
CAMERA_SHARED_SECRET — distinct from iOS's IOS_SHARED_SECRET / X-Voxelio-Key):
  POST /api/nonce   → cTRNG/Orbitport nonce + satSig
  POST /api/upload  → multipart bundle.json + scene.bin → swarm pin + cosign
  POST /api/mint    → on-chain mint + ENS subname publication

Vercel caps function bodies at ~4.5 MB. Cloud-mode scenes are routinely
7-15 MB, so without a direct-storage path big scenes were silently dropped
to a `local:<sha>` swarmRef and never actually pinned.

This client supports two upload paths:

  1. Direct-to-storage (Bee or Pinata) when SWARM_BEE_URL +
     SWARM_POSTAGE_BATCH_ID, or PINATA_JWT, are configured. The scene
     goes straight to storage (no Vercel cap), then bundle-only is posted
     to /api/upload for bundleHash + cosmoSig. This matches the iOS
     ProofSubmitter pattern noted in upload.routes.ts.

  2. Multipart fallback when no direct-storage creds are set. Tries the
     all-in-one /api/upload; falls back to local:<sha> when the scene
     exceeds the Vercel cap.
"""

from __future__ import annotations

from pathlib import Path

import requests


VERCEL_BODY_CAP = 4 * 1024 * 1024  # 4 MB to leave room for multipart framing


class BackendError(RuntimeError):
    pass


_SCENE_MIME = {
    ".usdz": "model/vnd.usdz+zip",
    ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json",
    ".ply": "application/octet-stream",
    ".npz": "application/octet-stream",
    ".obj": "text/plain",
}


def _scene_mime(path: Path) -> str:
    return _SCENE_MIME.get(path.suffix.lower(), "application/octet-stream")


class BackendClient:
    def __init__(
        self,
        base_url: str,
        shared_secret: str,
        timeout: float = 60.0,
        *,
        bee_url: str | None = None,
        postage_batch_id: str | None = None,
        pinata_jwt: str | None = None,
        # Bee/Pinata uploads can be much larger than the API call;
        # default to a generous 5min so cloud-mode .ply files (7-15 MB
        # over a residential line) actually finish.
        storage_timeout: float = 300.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.shared_secret = shared_secret
        self.timeout = timeout
        self.bee_url = (bee_url or "").rstrip("/") or None
        self.postage_batch_id = postage_batch_id or None
        self.pinata_jwt = pinata_jwt or None
        self.storage_timeout = storage_timeout

    @property
    def storage_backend(self) -> str:
        """Which direct-storage path will be used. UI/healthz read this."""
        if self.pinata_jwt:
            return "ipfs"
        if self.bee_url and self.postage_batch_id:
            return "swarm"
        return "none"

    def has_direct_storage(self) -> bool:
        return self.storage_backend != "none"

    def _headers(self) -> dict:
        return {"X-Camera-Key": self.shared_secret}

    def health(self) -> dict:
        try:
            r = requests.get(f"{self.base_url}/health", timeout=5)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            raise BackendError(f"health check failed: {e}") from e

    def get_nonce(self) -> dict:
        r = requests.post(
            f"{self.base_url}/api/nonce", headers=self._headers(), timeout=self.timeout
        )
        if r.status_code >= 400:
            raise BackendError(f"nonce {r.status_code}: {r.text}")
        return r.json()

    def upload_or_local(
        self, bundle_bytes: bytes, scene_path: Path, audio_path: Path | None = None,
    ) -> dict:
        """Pin the scene + bundle and return the iOS-canonical fields the
        mint route needs.

        Two paths:
          - Direct storage (preferred when configured): upload scene
            straight to Bee/Pinata (no Vercel cap), then post bundle-only
            to /api/upload for bundleHash + cosmoSig.
          - Multipart fallback: send everything to /api/upload. If the
            payload exceeds Vercel's cap, the scene can't be pinned →
            we still return a synthetic `swarmRef = local:<sha>` so the
            mint goes through, but the file isn't in any IPFS/Swarm —
            this is the path that was producing un-stored scenes before
            direct-storage support was added.
        """
        if self.has_direct_storage():
            return self._upload_direct(bundle_bytes, scene_path, audio_path)

        scene_size = scene_path.stat().st_size
        audio_size = audio_path.stat().st_size if audio_path and audio_path.exists() else 0
        estimated = scene_size + audio_size + len(bundle_bytes) + 4096
        if estimated > VERCEL_BODY_CAP:
            scene_sha = _file_sha256(scene_path)
            return {
                "swarmRef": f"local:{scene_sha}",
                "bundleRef": "local:bundle",
                "audioRef": None,
                "sceneBytes": scene_size,
                "cosmoSig": None,
                "_local": True,
                "_reason": f"scene too large for backend ({estimated} > {VERCEL_BODY_CAP}); "
                           "configure BEE_URL+SWARM_POSTAGE_BATCH_ID or PINATA_JWT to pin scenes",
            }
        return self._upload(bundle_bytes, scene_path, audio_path)

    def _upload_direct(
        self, bundle_bytes: bytes, scene_path: Path, audio_path: Path | None,
    ) -> dict:
        """Upload scene (and audio) straight to Bee/Pinata, then call the
        backend with bundle-only to obtain bundleHash + cosmoSig.

        Splitting the upload this way is what unlocks files >4MB: only
        the bundle JSON (a few KB) ever crosses the Vercel boundary."""
        scene_ref, scene_size = self._pin_file(
            scene_path, content_type=_scene_mime(scene_path),
        )
        audio_ref = None
        if audio_path is not None and audio_path.exists():
            audio_ref, _ = self._pin_file(audio_path, content_type="audio/mp4")

        cosign = self._upload_bundle_only(bundle_bytes)
        return {
            "swarmRef": scene_ref,
            "bundleRef": cosign.get("bundleRef") or "",
            "audioRef": audio_ref,
            "sceneBytes": scene_size,
            "cosmoSig": cosign.get("cosmoSig"),
            "_storage": self.storage_backend,
        }

    def _pin_file(self, path: Path, content_type: str) -> tuple[str, int]:
        """Direct upload to whichever storage backend is configured.

        Returns (reference, size_bytes). Reference shape matches what the
        backend's /api/upload returns (Bee swarm hex hash or Pinata
        IPFS CID), so it's a drop-in for swarmRef on the mint side."""
        if self.pinata_jwt:
            return self._pin_to_pinata(path)
        if self.bee_url and self.postage_batch_id:
            return self._pin_to_bee(path, content_type)
        raise BackendError("no direct-storage credentials configured")

    def _pin_to_bee(self, path: Path, content_type: str) -> tuple[str, int]:
        size = path.stat().st_size
        # ?name=<filename> tells Bee to wrap the upload in a single-file
        # manifest so the gateway returns Content-Type +
        # Content-Disposition. Mirrors swarm.service.ts.
        url = f"{self.bee_url}/bzz?name={requests.utils.quote(path.name)}"
        try:
            with path.open("rb") as f:
                r = requests.post(
                    url,
                    headers={
                        "Content-Type": content_type,
                        "Swarm-Postage-Batch-Id": self.postage_batch_id or "",
                    },
                    data=f,
                    timeout=self.storage_timeout,
                )
        except requests.RequestException as e:
            raise BackendError(f"bee upload failed: {e}") from e
        if r.status_code >= 400:
            raise BackendError(f"bee upload {r.status_code}: {r.text}")
        try:
            ref = r.json().get("reference")
        except Exception as e:
            raise BackendError(f"bee returned non-JSON: {r.text!r}") from e
        if not ref:
            raise BackendError(f"bee response missing reference: {r.text!r}")
        return ref, size

    def _pin_to_pinata(self, path: Path) -> tuple[str, int]:
        size = path.stat().st_size
        try:
            with path.open("rb") as f:
                r = requests.post(
                    "https://api.pinata.cloud/pinning/pinFileToIPFS",
                    headers={"Authorization": f"Bearer {self.pinata_jwt}"},
                    files={"file": (path.name, f)},
                    timeout=self.storage_timeout,
                )
        except requests.RequestException as e:
            raise BackendError(f"pinata upload failed: {e}") from e
        if r.status_code >= 400:
            raise BackendError(f"pinata upload {r.status_code}: {r.text}")
        try:
            cid = r.json().get("IpfsHash")
        except Exception as e:
            raise BackendError(f"pinata returned non-JSON: {r.text!r}") from e
        if not cid:
            raise BackendError(f"pinata response missing IpfsHash: {r.text!r}")
        return cid, size

    def _upload_bundle_only(self, bundle_bytes: bytes) -> dict:
        """Multipart POST to /api/upload with no scene part. The backend
        treats the scene as optional and still returns bundleRef +
        bundleHash + cosmoSig — exactly what we need when the scene was
        pinned out-of-band."""
        files = [("bundle", ("bundle.json", bundle_bytes, "application/json"))]
        try:
            r = requests.post(
                f"{self.base_url}/api/upload",
                headers=self._headers(),
                files=files,
                timeout=self.timeout,
            )
        except requests.RequestException as e:
            raise BackendError(f"bundle cosign request failed: {e}") from e
        if r.status_code >= 400:
            raise BackendError(f"bundle cosign {r.status_code}: {r.text}")
        try:
            return r.json()
        except Exception as e:
            raise BackendError(f"bundle cosign non-JSON: {r.text!r}") from e

    def _upload(self, bundle_bytes: bytes, scene_path: Path, audio_path: Path | None) -> dict:
        with scene_path.open("rb") as scene_f:
            files = [
                ("bundle", ("bundle.json", bundle_bytes, "application/json")),
                ("scene", (scene_path.name, scene_f, _scene_mime(scene_path))),
            ]
            audio_f = None
            if audio_path is not None and audio_path.exists():
                audio_f = audio_path.open("rb")
                files.append(("audio", (audio_path.name, audio_f, "audio/mp4")))
            try:
                r = requests.post(
                    f"{self.base_url}/api/upload",
                    headers=self._headers(),
                    files=files,
                    timeout=self.timeout,
                )
            finally:
                if audio_f is not None:
                    audio_f.close()
        if r.status_code == 413:
            raise BackendError("upload rejected: 413 (body too large for Vercel)")
        if r.status_code >= 400:
            raise BackendError(f"upload {r.status_code}: {r.text}")
        return r.json()

    def mint(
        self,
        *,
        swarm_ref: str,
        bundle_ref: str,
        bundle_hash: str,
        sat_sig: str,
        cosmo_sig: str | None,
        attestation: str,
        attestation_type: int = 1,
        captured_at: int,
        mode: int = 1,
        label: str | None = None,
        recipient: str | None = None,
    ) -> dict:
        body = {
            "swarmRef": swarm_ref,
            "bundleRef": bundle_ref,
            "bundleHash": bundle_hash,
            "satSig": sat_sig or "STUB",
            "cosmoSig": cosmo_sig or "",
            "attestation": attestation or "MOCK",
            "attestationType": int(attestation_type),
            "capturedAt": int(captured_at),
            "mode": int(mode),
        }
        # Optional knobs the backend's mint route accepts. Omit when
        # unset so the backend's defaults (auto vin-* label, mint to
        # backend's minter address) keep working.
        if label:
            body["label"] = label
        if recipient:
            body["to"] = recipient
        r = requests.post(
            f"{self.base_url}/api/mint",
            headers={**self._headers(), "Content-Type": "application/json"},
            json=body,
            timeout=self.timeout,
        )
        if r.status_code >= 400:
            raise BackendError(f"mint {r.status_code}: {r.text}")
        return r.json()


def _file_sha256(path: Path) -> str:
    import hashlib
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()
