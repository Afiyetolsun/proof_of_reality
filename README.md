# oak-scan-and-sign

Hardware-attested 3D room scanner. Capture a colored point cloud with a
[Luxonis OAK4](https://docs.luxonis.com/) RGB-D camera and sign its hash with
a hardware-derived key from a [USB Armory MK II](https://github.com/usbarmory/usbarmory)
running a [GoTEE](https://github.com/usbarmory/GoTEE) trusted applet.

Built as the **hardware capture station** for *Proof of Reality* — an
ETHPrague 2026 / SpaceComputer-track project that anchors physical-object
scans to cryptographic proof so they can't be forged by AI.

> Status: hackathon prototype. End-to-end working: record → SLAM → PLY →
> SHA-256 → TEE-signed envelope.

See the rest of the docs for setup, deployment, and architecture.
