"""Reconstruct + export scene file (GLB / PLY)."""
from __future__ import annotations

from pathlib import Path


def export_scene(capture_dir: Path, output: Path) -> Path:
    """Stub. Real impl: depth fusion + texture, write .glb via open3d.

    For the hackathon stub, just write an empty file so the pipeline runs end-to-end.
    """
    output.write_bytes(b"glb-stub\x00\x00")
    return output
