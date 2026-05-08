"""Tiny kiosk UI: trigger capture, show QR, show success URL."""
from __future__ import annotations


class KioskDisplay:
    def __init__(self, mode: str = "none") -> None:
        self.mode = mode

    def wait_for_trigger(self) -> None:
        if self.mode == "none":
            input("[kiosk] press <enter> to capture > ")
        else:
            # TODO: GPIO button via gpiozero
            input("[kiosk] press <enter> to capture > ")

    def show_qr(self, payload: str) -> None:
        # TODO: render QR on display
        print(f"[kiosk] QR payload: {payload}", flush=True)

    def show_success(self, url: str) -> None:
        print(f"[kiosk] ✅ minted: {url}", flush=True)
