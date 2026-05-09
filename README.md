# oak-scan-and-sign

<p align="center">
  <img src="assets/hero.gif" alt="Recording a room and signing the result with hardware-derived key" width="720">
</p>

Hardware-attested 3D room scanner. Capture a colored point cloud with a
[Luxonis OAK4](https://docs.luxonis.com/) RGB-D camera and sign its hash
with a hardware-derived key from a [USB Armory MK II](https://github.com/usbarmory/usbarmory)
running a [GoTEE](https://github.com/usbarmory/GoTEE) trusted applet.

Built as the **hardware capture station** for *Proof of Reality* — an
ETHPrague 2026 / SpaceComputer-track project that anchors physical-object
scans to cryptographic proof so they can't be forged by AI.

> Status: hackathon prototype. End-to-end working: record → SLAM → PLY →
> SHA-256 → TEE-signed envelope.

<table>
<tr>
  <td align="center" width="33%">
    <img src="assets/ui-record.gif" alt="Recorder UI">
    <br><sub>Web UI: Start → pan → Stop & sign</sub>
  </td>
  <td align="center" width="33%">
    <img src="assets/pointcloud.gif" alt="Resulting point cloud rotating">
    <br><sub>Output PLY: world-aligned colored cloud</sub>
  </td>
  <td align="center" width="33%">
    <img src="assets/hardware.jpg" alt="OAK4 + USB Armory wired together">
    <br><sub>Hardware: OAK4 + USB Armory MK II</sub>
  </td>
</tr>
</table>

---

## What it does

Three capture modes, all signed the same way:

| Mode | UX | Output | Use it for |
|---|---|---|---|
| 📷 **Photo** | One click | `<id>.ply` (depth → coloured points, current view) | Quick attested 3D snapshot |
| 🎥 **Video** | Start → record → Stop | `<id>.npz` (RGB + depth stack + intrinsics + ts) | Replayable / re-projectable scan |
| 🌐 **Cloud** | Start → record → Stop | `<id>.ply` (TSDF SLAM merge) | Whole-room reconstruction |

For all three:

1. **Capture.** OAK4 stereo cameras + colour camera produce synchronised
   RGB + depth frames (640×400 @ 10 fps) on-device. A `dai.node.Sync`
   pairs each colour ImgFrame with its colour-aligned depth frame.
2. **Process.** Photo back-projects one frame; Video buffers the frame
   stream; Cloud runs Open3D RGB-D odometry + `ScalableTSDFVolume`
   integration (CPU-only, no IMU).
3. **Save.** A binary PLY (Photo / Cloud) or a compressed NPZ (Video).
4. **Hash + sign.** SHA-256 of the artifact is sent to the USB Armory's
   GoTEE bridge. The Trusted Applet (`gotee-applet/sign_hash.rs`)
   HMAC-SHA256s it with a hardware-derived key whose private half never
   leaves Secure World.
5. **Envelope.** A JSON sidecar lands next to the artifact:

   ```json
   {
     "scan_id": "832eb454e7c8",
     "mode": "cloud",
     "artifact": "832eb454e7c8.ply",
     "artifact_sha256": "9f7bb9a13d91…",
     "ply_sha256": "9f7bb9a13d91…",
     "point_count": 22841,
     "integrated": 20,
     "duration_s": 6.193,
     "gotee": {
       "device_id": "558075540a46e624",
       "nonce": "82b0ada2a4dd39adabe85891a9b0220f",
       "mac": "8e4b19431c16bfebbe307c46628ba49b8646b26ce49f2070037e7851043d3ce6"
     }
   }
   ```

   `mac = HMAC-SHA256(derived_key, sha256_bytes || nonce)`. Anyone with
   the same Armory can recompute the MAC and verify the scan was produced
   by *this* hardware after the nonce was generated.

### REST API

| Endpoint | What |
|---|---|
| `POST /capture/photo` | Snapshot the current frame. Returns the envelope synchronously. |
| `POST /record/start/{video\|cloud}` | Begin a recording session. |
| `POST /record/stop` | Finalise the active recording. Returns the envelope. |
| `GET /record/state` | Current mode + scan_id + elapsed + frame count. |
| `GET /scans` | All envelopes, newest first. |
| `GET /scans/{filename}` | Download a `.ply` / `.npz` / `.json`. |
| `GET /debug/network` | In-container connectivity dump (nc to bridge etc). |
| `GET /config` | UI config bag (viz port, mode caps). |

---

## Architecture

<p align="center">
  <img src="assets/architecture.png" alt="System architecture diagram" width="720">
</p>

(Same picture in ASCII for terminal-only readers:)

```
   ┌──── browser ────┐
   │ Start / Stop UI │
   └────────┬────────┘
            │ HTTP
            ▼
   ┌─────────────── OAK4 (oakapp container) ───────────────┐
   │                                                       │
   │  FastAPI :8080  ──┐                                   │
   │                   │                                   │
   │  O3DRecorder      │     depthai pipeline:             │
   │  (TSDF + RGBD     │     stereo + colour + ImageAlign  │
   │   odometry)  ◀────┘     + Sync(colour, depth)         │
   │       │                                               │
   │       │ on Stop                                       │
   │       ▼                                               │
   │  PLY → SHA-256                                        │
   │       │                                               │
   │       │ nc :4000                                      │
   │       ▼                                               │
   │  TCP forwarder (host) ──── usb0 ───┐                  │
   │  scripts/forwarder.py              │                  │
   └────────────────────────────────────│──────────────────┘
                                        │
                                        ▼  CDC-ECM 10.0.0.1:4000
                              ┌───── USB Armory MK II ─────┐
                              │  Trusted OS (GoTEE)        │
                              │     │                      │
                              │     ▼                      │
                              │  Sign applet (Secure       │
                              │   World user mode)         │
                              │     • RPC.Attest → key     │
                              │     • SYS_GETRANDOM nonce  │
                              │     • HMAC-SHA256          │
                              └────────────────────────────┘
```

The container can't see `usb0` directly (separate netns), so a Python TCP
forwarder on the OAK host bridges `<lan-ip>:4000 → 10.0.0.1:4000`.
`oakapp.toml` passes `--gotee-host=$(hostname -I | awk '{print $1}')` so
the recorder dials the host LAN IP.

---

## Repo layout

```
.
├── main.py             FastAPI server + depthai pipeline + O3DRecorder
├── ply_writer.py       binary PLY writer + voxel downsample
├── signer.py           gotee bridge client (shells out to nc)
├── static/index.html   recorder UI
├── oakapp.toml         oakapp container manifest
├── requirements.txt    runtime deps
├── gotee-applet/       Rust no_std applet for the USB Armory
│   ├── README.md       build + flash instructions
│   └── sign_hash.rs    HMAC-SHA256 with hardware-derived key
└── scripts/
    ├── deploy.sh           scp scripts to OAK and run setup (--systemd opt)
    ├── forwarder.py        TCP relay (runs on the OAK host)
    ├── oak-host-setup.sh   one-shot: bring up usb0, start forwarder
    ├── install-systemd.sh  install oak-gotee.service for boot auto-start
    └── oak-gotee.service   systemd unit (BindsTo usb0 device, Restart=always)
```

---

## Hardware

- **Luxonis OAK4** (RVC4 / Qualcomm kalama) — runs the oakapp container
  itself. Tested with a stock OAK4 over LAN.
- **USB Armory MK II** (i.MX6ULL) — plugs into the OAK4's USB-A host port.
  Boot switch on µSD, `gotee_starter` Trusted OS flashed.

The OAK4 enumerates the Armory as a CDC-Ethernet device; the host kernel
brings up `usb0` and routes `10.0.0.0/24` over USB.

---

## Deploy

### 1. Flash the applet onto the Armory (one-time)

Drop [`gotee-applet/sign_hash.rs`](gotee-applet/sign_hash.rs) into a
[gotee_starter](https://github.com/usbarmory/usbarmory) checkout, add
`sha2` and `hmac` to `docker/Cargo.toml`, then:

```bash
make applet
bun run upload target/armv7a-none-eabi/release/trusted_applet
```

Full instructions in [`gotee-applet/README.md`](gotee-applet/README.md).

### 2. Set up the OAK host

**One-shot (this boot only):**

```bash
OAK_IP=192.168.88.236 ./scripts/deploy.sh
```

Brings `usb0` up at `10.0.0.2/24` and starts the forwarder in the
background. Goes away on reboot. Good for first-time testing.

**Persistent (recommended):**

```bash
OAK_IP=192.168.88.236 ./scripts/deploy.sh --systemd
```

Installs the forwarder as a systemd unit (`oak-gotee.service`) that:

- auto-starts on boot,
- auto-restarts if the python process dies,
- is `BindsTo` the `cdc_ether` `usb0` device — when you unplug the
  Armory the service stops; when you plug it back in it starts again.

After install you can manage it like any other service:

```bash
ssh root@<oak-ip> 'systemctl status oak-gotee'
ssh root@<oak-ip> 'journalctl -u oak-gotee -f'
ssh root@<oak-ip> 'systemctl restart oak-gotee'
```

### 3. Deploy the oakapp

```bash
oakctl connect 192.168.88.236
oakctl app run .
```

Open **http://&lt;oak-ip&gt;:8080** and hit Start.

<p align="center">
  <img src="assets/deploy.gif" alt="oakctl deploy + first scan" width="720">
</p>

### 4. Local development (peripheral mode)

You can also run the recorder on your laptop against an OAK on the LAN:

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python main.py -d 192.168.88.236 --no-sign
```

`--no-sign` skips the gotee call; the envelope's `gotee` field will be
`null` and the PLY is still written.

---

## Verification (sketch)

A verifier holding the same Armory can recompute the MAC:

```python
import hashlib, json, signer
env = json.load(open("scans/<id>.json"))
ply_sha = hashlib.sha256(open(f"scans/{env['scan_id']}.ply", "rb").read()).hexdigest()
assert ply_sha == env["ply_sha256"]
# call Sign with payload = ply_sha256 hex; compare device_id + recompute mac
# (the applet's nonce is fresh per call — verification means producing a
#  new envelope with the same ply_sha256 and confirming the device_id matches)
```

For the full Proof of Reality construction (cosmic nonce binding via
SpaceComputer's Orbitport, on-chain mint, anti-spoof classifier), this
repo is one component — the hardware capture + TEE-signed hash. The
broader system layers a satellite-derived nonce into the capture and
mints the result as an on-chain Reality NFT.

---

## Caveats / known issues

- **No IMU in the SLAM path.** Open3D RGB-D odometry is purely visual; fast
  motion or featureless walls cause drift. Pan slowly.
- **`usb0` drops on sshd restarts.** The systemd service brings it back
  automatically (re-adds the `10.0.0.2/24` address on every restart);
  if you used the one-shot `deploy.sh` path instead, re-run it manually.
- **The HMAC binds `payload || nonce` only.** A production envelope should
  also bind `ts`, `device_id`, and (for Proof of Reality) the cosmic
  Orbitport nonce.
- **No anti-AI classifier yet.** That's the third pillar of Proof of
  Reality and lives outside this repo.

---

## License

MIT — see [LICENSE](LICENSE).
