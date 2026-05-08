# @proof-of-reality/camera-agent

B2B capture agent. Runs on a Luxonis OAK 4 D, signs bundles via a USB Armory Mk II
plugged into the camera's USB-C port.

## Layout

```
src/proof_of_reality_agent/
├── main.py            # capture loop entry
├── canonical.py       # Python mirror of @proof-of-reality/proof-bundle
├── pipeline/capture.py   # DepthAI v3 capture
├── recon/export.py       # point cloud / GLB export
├── attest/
│   ├── base.py        # Signer protocol
│   ├── usb_armory.py  # talks HTTP to firmware/armory-signer
│   ├── mock.py        # software fallback for dev
│   └── factory.py
├── net/client.py      # backend HTTP client
└── kiosk/display.py   # button + display

firmware/armory-signer/    # bare-metal TamaGo Go firmware for the USB Armory
deploy/install.sh          # ssh-deploy to camera
```

## Setup

```bash
cd apps/camera-agent
uv sync
cp .env.example .env  # fill in PROOF_API_URL, PROOF_API_TOKEN, ORG_ATTESTOR_ADDR
uv run proof-agent    # waits for trigger, runs full capture+sign+upload+mint
```

## Hardware path (canonical)

1. Plug USB Armory Mk II into OAK 4 D's USB-C
2. Armory boots TamaGo signer firmware, presents 10.0.0.1 over USB CDC Ethernet
3. Camera agent calls `http://10.0.0.1/sign` to sign every bundle
4. Org admin pre-registers the device on-chain via `apps/viewer/provision`

## Dev path (no hardware)

```bash
ATTEST_BACKEND=mock uv run proof-agent
```

Software keypair persists at `~/.proof-agent/dev-key`. Identical bundle shape;
only the security property degrades.
