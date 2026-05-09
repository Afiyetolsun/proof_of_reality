# assets

Visuals embedded in the top-level README. All filenames are referenced
literally in `../README.md` — keep them stable.

| File | What it should show | Suggested length / size |
|---|---|---|
| `hero.gif` | Top-of-readme money shot. Browser UI on the left, depthai live preview on the right, the user clicks Start, scans for a few seconds, clicks Stop & sign, the scan card appears with a real `mac …` line. One smooth take. | 8–12 s, ≤ 4 MB, ≤ 1280 px wide |
| `ui-record.gif` | Just the recorder UI sidebar — Start clicked, frames counter climbing, Stop, scan card animates in. No depthai pane. | 6–8 s, ≤ 2 MB |
| `pointcloud.gif` | The resulting `.ply` opened in MeshLab / CloudCompare / Open3D viewer, slowly rotating. Proves the SLAM output is a real, recognisable scene. | 6 s loop, ≤ 2 MB |
| `hardware.jpg` | Photo of the actual rig: OAK4 with the USB Armory plugged into its USB-A port, on a desk, well lit. | ≤ 800 px wide, ≤ 400 KB |
| `architecture.png` | Polished version of the ASCII diagram in the README. Anything that renders the same boxes + arrows works (Excalidraw, draw.io, Figma export). | ≤ 1400 px wide |
| `deploy.gif` | Terminal: `oakctl app run .` → boot logs scrolling → "O3D pipeline running" → cut to browser opening localhost:8080. | 8 s, ≤ 2 MB |

## Recording tips

- **GIF size:** keep each under ~3 MB if possible. GitHub renders larger ones
  fine but mobile readers will hate you.
- **Tools:**
  - macOS: [Kap](https://getkap.co/) or QuickTime → ezgif.com to convert.
  - Linux: `peek` or `byzanz`.
  - Terminal-only clips: `asciinema` + `agg` produces tiny crisp GIFs.
- **Frame rate:** 10 fps is plenty for UI demos and keeps the file small.
- **Crop tightly.** No empty desktop wallpaper.
- **Loops:** for the pointcloud rotation, ensure the first and last frame
  match so the loop doesn't visibly snap.

## Architecture diagram

If you want to redo the architecture diagram from scratch, the source-of-truth
is the ASCII version in `../README.md`. Boxes:

- Browser (Start/Stop UI)
- OAK4 oakapp container (FastAPI :8080, O3DRecorder, depthai pipeline)
- TCP forwarder on OAK host (`scripts/forwarder.py`)
- USB Armory MK II (Trusted OS + Sign applet)

Arrows: HTTP request, depthai messages, `nc :4000`, CDC-ECM (`usb0`).
