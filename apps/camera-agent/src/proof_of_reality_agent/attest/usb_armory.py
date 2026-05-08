"""USB Armory Mk II signer.

Talks HTTP to the bare-metal TamaGo signer firmware running on the Armory.
The Armory enumerates as a USB CDC Ethernet device (10.0.0.1/24); the camera
is the host (10.0.0.2). Tiny HTTP server inside the firmware exposes:

    GET  /pubkey  -> { "address": "0x…" }
    POST /sign    -> body: { "hash": "0x…" } -> { "sig": "0x…", "address": "0x…" }
    GET  /attest  -> { "vendor": "usb-armory-mk2", "fwVersion": "…" }

Firmware lives in apps/camera-agent/firmware/armory-signer/.
"""
from __future__ import annotations

import os

import httpx


class USBArmorySigner:
    vendor = "usb-armory-mk2"

    def __init__(self, base_url: str | None = None, timeout: float = 5.0) -> None:
        self.base_url = (base_url or os.environ.get("ARMORY_SIGNER_URL", "http://10.0.0.1")).rstrip("/")
        self._timeout = timeout
        self._client = httpx.Client(timeout=timeout)
        self._cached_addr: str | None = None

    def address(self) -> str:
        if self._cached_addr:
            return self._cached_addr
        r = self._client.get(f"{self.base_url}/pubkey")
        r.raise_for_status()
        self._cached_addr = r.json()["address"]
        return self._cached_addr

    def sign(self, digest_hex: str) -> str:
        if not digest_hex.startswith("0x") or len(digest_hex) != 66:
            raise ValueError(f"expected 0x + 64 hex chars, got {digest_hex!r}")
        r = self._client.post(f"{self.base_url}/sign", json={"hash": digest_hex})
        r.raise_for_status()
        sig = r.json()["sig"]
        if not sig.startswith("0x") or len(sig) not in (132, 130):
            raise ValueError(f"unexpected sig format: {sig!r}")
        return sig
