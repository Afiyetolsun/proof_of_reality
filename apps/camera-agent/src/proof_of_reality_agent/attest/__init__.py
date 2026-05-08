"""Hardware attestation backends. Picked at runtime by env var."""
from __future__ import annotations

from .base import Signer
from .factory import make_signer

__all__ = ["Signer", "make_signer"]
