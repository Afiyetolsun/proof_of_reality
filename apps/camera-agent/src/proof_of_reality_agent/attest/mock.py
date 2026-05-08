"""Software signer for laptop dev — NO HARDWARE REQUIRED.

Generates a secp256k1 keypair on first run, persists it to ~/.proof-agent/dev-key,
and produces Ethereum-style recoverable signatures (r || s || v, 65 bytes / 130
hex chars) that the viewer's verifyDeviceSig can ecrecover identically to a real
USB Armory signature.

NOT FOR PRODUCTION — this is a file on disk. The whole point of the USB Armory
path is that the key never leaves the chip; this file makes the schema work
without the chip so iOS/B2B can be tested independently.
"""
from __future__ import annotations

import json
import secrets
from pathlib import Path

from coincurve import PrivateKey
from Crypto.Hash import keccak


KEY_PATH = Path.home() / ".proof-agent" / "dev-key.json"


def _eth_address(uncompressed_pub: bytes) -> str:
    """Derive the Ethereum-style address (last 20 bytes of keccak256(pubkey[1:]))."""
    if len(uncompressed_pub) != 65 or uncompressed_pub[0] != 0x04:
        raise ValueError("expected 65-byte uncompressed pubkey with 0x04 prefix")
    h = keccak.new(digest_bits=256)
    h.update(uncompressed_pub[1:])
    return "0x" + h.digest()[-20:].hex()


class MockSigner:
    vendor = "usb-armory-mk2"  # so on-chain bundle parses identically to the real path

    def __init__(self) -> None:
        if KEY_PATH.exists():
            raw = json.loads(KEY_PATH.read_text())
            self._sk = PrivateKey(bytes.fromhex(raw["privkey"]))
        else:
            KEY_PATH.parent.mkdir(parents=True, exist_ok=True)
            seed = secrets.token_bytes(32)
            self._sk = PrivateKey(seed)
            KEY_PATH.write_text(json.dumps({"privkey": seed.hex()}))
            print(f"[mock-signer] generated new dev key at {KEY_PATH}")

        self._pub_uncompressed = self._sk.public_key.format(compressed=False)
        self._addr = _eth_address(self._pub_uncompressed)

    def address(self) -> str:
        return self._addr

    def pubkey(self) -> str:
        """Full uncompressed pubkey (0x04 + 64 bytes), useful for off-chain
        verification when the device hasn't been registered yet."""
        return "0x" + self._pub_uncompressed.hex()

    def sign(self, digest_hex: str) -> str:
        """Sign the 32-byte digest, return Ethereum-style 0x + 130 hex (r||s||v).

        v is 27 + recovery_id, matching ecrecover semantics.
        """
        clean = digest_hex.removeprefix("0x")
        digest = bytes.fromhex(clean)
        if len(digest) != 32:
            raise ValueError(f"sign: expected 32-byte digest, got {len(digest)}")
        # coincurve produces 65 bytes: r(32) || s(32) || v(1) where v is 0/1
        sig_recoverable = self._sk.sign_recoverable(digest, hasher=None)
        r, s, recovery_id = sig_recoverable[:32], sig_recoverable[32:64], sig_recoverable[64]
        v = bytes([27 + recovery_id])
        return "0x" + (r + s + v).hex()
