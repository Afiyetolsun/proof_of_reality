"""Pick a Signer implementation by env var."""
from __future__ import annotations

from .base import Signer


def make_signer(backend: str) -> Signer:
    backend = backend.lower()
    if backend == "armory" or backend == "usb-armory-mk2":
        from .usb_armory import USBArmorySigner
        return USBArmorySigner()
    if backend == "mock":
        from .mock import MockSigner
        return MockSigner()
    if backend == "atecc608":
        raise NotImplementedError("ATECC608 path not wired yet")
    raise ValueError(f"unknown attest backend: {backend!r}")
