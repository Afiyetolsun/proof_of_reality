"""Signer interface — any HW backend implements this."""
from __future__ import annotations

from typing import Protocol


class Signer(Protocol):
    """Hardware-resident signer. Private key never leaves the chip."""

    vendor: str  # "usb-armory-mk2" | "atecc608" | "se05x" | "mock"

    def address(self) -> str:
        """Return the Ethereum-style address (0x + 40 hex chars) of the device pubkey."""

    def sign(self, digest_hex: str) -> str:
        """Sign a 32-byte hash (0x-prefixed hex). Return r||s||v as 0x + 130 hex chars."""
