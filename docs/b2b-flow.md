# B2B flow — OAK 4 D edge camera + USB Armory Mk II

Stationary capture station. No phone in the loop. Best fit for: insurance intake desks, supply-chain QA gates, auction houses, evidence rooms, returns docks.

## Hardware

- **Luxonis OAK 4 D** — 48 MP RGB + stereo depth, Qualcomm QCS8550, runs Luxonis OS (Linux 5.15)
- **USB Armory Mk II** — plugged into the OAK's USB-C, runs bare-metal TamaGo signer firmware
- **Optional kiosk display** — small screen showing nonce QR + success state
- **Trigger** — physical button (best for demo) or REST endpoint or motion detection

## One-time provisioning (per camera)

1. Operator powers up the OAK 4 D and plugs the Armory into its USB-C
2. Armory firmware boots, generates ECDSA secp256k1 keypair on first boot, encrypts private key with OTPMK, persists to encrypted partition
3. Camera agent reads `GET /pubkey` from Armory → device address
4. Agent fetches a "birth nonce" from `/api/nonce` (cosmic nonce captured at provisioning)
5. Agent prints a QR with `{ deviceAddr, deviceSerial, birthNonce, vendorAttestation }`
6. **Org admin** scans the QR with their wallet on `apps/viewer/provision`, calls `DeviceRegistry.register(deviceAddr, birthNonce, label, vendorAttestation)` from their org wallet
7. Camera now has on-chain identity rooted in the org's wallet

## Capture flow (per scan)

```
Operator              Agent (OAK 4 D)        Armory       Backend       Orbitport     Swarm    Base
   │                       │                    │            │              │           │       │
   │ press button          │                    │            │              │           │       │
   ├──────────────────────►│                    │            │              │           │       │
   │                       │ POST /api/nonce    │            │              │           │       │
   │                       ├───────────────────────────────►│              │           │       │
   │                       │ ◄─── { value, satSig }─────────│              │           │       │
   │                       │ render QR on display          │              │           │       │
   │                       │ DepthAI v3 capture (8s)        │              │           │       │
   │                       │ depth fusion → glb             │              │           │       │
   │                       │ build bundle, compute          │              │           │       │
   │                       │  deviceSigningHash             │              │           │       │
   │                       │                    │           │              │           │       │
   │                       │ POST /sign         │           │              │           │       │
   │                       ├───────────────────►│           │              │           │       │
   │                       │ ◄── { sig, addr }──│           │              │           │       │
   │                       │                    │           │              │           │       │
   │                       │ POST /api/upload (scene + bundle)            │           │       │
   │                       ├───────────────────────────────►│              │           │       │
   │                       │                    │           │ kms.sign(hash)│          │       │
   │                       │                    │           ├──────────────►│          │       │
   │                       │                    │           │ ◄── cosmoSig──│          │       │
   │                       │                    │           │ verify deviceSig         │       │
   │                       │                    │           │ check DeviceRegistry     │       │
   │                       │                    │           │ embed spaceFabric        │       │
   │                       │                    │           │ /bzz x 2 ────────────────►│       │
   │                       │ ◄── { refs, bundleHash }───────│              │           │       │
   │                       │                    │           │              │           │       │
   │                       │ POST /api/mint     │           │              │           │       │
   │                       ├───────────────────────────────►│              │           │       │
   │                       │                    │           │ RealityProof.mint(…) ────────────►│
   │                       │ ◄── { txHash }─────────────────│              │           │       │
   │                       │ kiosk shows ✅ + viewer URL    │              │           │       │
```

## Key property

The camera and the operator can be fully compromised — the Armory's private key still cannot be extracted (DCP+OTPMK). Stolen camera → org revokes the device address in `DeviceRegistry`, every future scan from it fails verification at step 4 of the viewer's check pipeline.

## Bundle attestation block

```jsonc
"attestation": {
  "type": "deviceSE",
  "deviceSE": {
    "deviceAddr":         "0x04abc…",
    "deviceSig":          "0x…(r||s||v 130 hex)",
    "vendor":             "usb-armory-mk2",
    "vendorAttestation":  "…"
  }
}
```
