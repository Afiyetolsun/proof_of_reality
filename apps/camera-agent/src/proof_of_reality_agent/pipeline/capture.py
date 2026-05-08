"""DepthAI v3 capture pipeline.

Runs synchronized RGB + stereo + IMU capture on the OAK 4 D, dumps frames + IMU
trace to a directory for downstream reconstruction.

This is a stub showing the right SDK shape. Replace with real DepthAI v3 graph
once the camera is online.
"""
from __future__ import annotations

import time
from pathlib import Path


class CaptureSession:
    def __init__(self, duration_sec: int = 8) -> None:
        self.duration_sec = duration_sec
        self.started_at: int = 0
        self.ended_at: int = 0
        self.frame_count: int = 0

    def run(self, output_dir: Path) -> None:
        self.started_at = int(time.time())
        # TODO: real DepthAI v3 pipeline. For now: stub that writes a marker file.
        time.sleep(min(self.duration_sec, 1))
        (output_dir / "STUB_CAPTURE").write_text("placeholder")
        self.frame_count = 240  # ~30fps * 8s
        self.ended_at = int(time.time())
