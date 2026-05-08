"""Mock signer for dev without hardware.

Generates a software keypair on first init, persists to ~/.proof-agent/dev-key.
NOT FOR PRODUCTION — has the security properties of "any file on disk".
"""
from __future__ import annotations

import json
import os
import secrets
from pathlib import Path

from Crypto.Hash import keccak
from ecdsa import SECP256k1, SigningKey


KEY_PATH = Path.home() / ".proof-agent" / "dev-key.json"


def _derive_address(verifying_key_bytes: bytes) -> str:
    h = keccak.new(digest_bits=256)
    h.update(verifying_key_bytes)
    return "0x" + h.digest()[-20:].hex()


class MockSigner:
    vendor = "usb-armory-mk2"  # so the bundle still parses; flag the dev nature in pitch

    def __init__(self) -> None:
        if KEY_PATH.exists():
            raw = json.loads(KEY_PATH.read_text())
            self._sk = SigningKey.from_string(bytes.fromhex(raw["privkey"]), curve=SECP256k1)
        else:
            KEY_PATH.parent.mkdir(parents=True, exist_ok=True)
            seed = secrets.token_bytes(32)
            self._sk = SigningKey.from_string(seed, curve=SECP256k1)
            KEY_PATH.write_text(json.dumps({"privkey": seed.hex()}))
        self._vk_bytes = self._sk.get_verifying_key().to_string()  # 64 bytes raw
        self._addr = _derive_address(self._vk_bytes)

    def address(self) -> str:
        return self._addr

    def sign(self, digest_hex: str) -> str:
        digest = bytes.fromhex(digest_hex.removeprefix("0x"))
        # Mock: produce r||s||v with a fake recovery byte. Real device uses
        # ecdsa-with-recovery; this is just so the schema parses.
        sig = self._sk.sign_digest(digest)
        return "0x" + sig.hex() + "1b"
