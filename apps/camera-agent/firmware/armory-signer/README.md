# armory-signer — bare-metal Go firmware

Runs on USB Armory Mk II via [TamaGo](https://github.com/usbarmory/tamago).

## Why bare metal

We need an HSM-grade signing surface that:

- Generates and stores its private key inside the i.MX6ULL DCP, encrypted by the chip-unique OTPMK
- Never exposes the private key to any code outside the secure crypto engine
- Survives the OAK 4 D's host being rooted

Bare-metal Go on TamaGo is the right shape — no Linux means no kernel-mode attack surface.

## API (HTTP over USB CDC Ethernet)

The firmware presents itself as a USB Ethernet device. The host (camera) sees it at `10.0.0.1`.

```
GET  /pubkey   -> { "address": "0x<40 hex>" }
POST /sign     -> body: { "hash": "0x<64 hex>" }
                  -> { "sig": "0x<130 hex>", "address": "0x<40 hex>" }
GET  /attest   -> { "vendor": "usb-armory-mk2", "fwVersion": "..." }
```

The signature is `r || s || v` (65 bytes, 130 hex chars), recoverable via Ethereum-style ecrecover.

## Build

```
make build
```

## Flash

Boot the Armory in U-Boot mode (microSD slot empty + boot mode switch), then:

```
make flash
```

## Status

Skeleton only. To finish before demo: DCP key gen + encrypt, USB CDC Ethernet bringup, HTTP router. ~6–8h of focused TamaGo work.

If TamaGo blocks: fall back to `apps/camera-agent/src/proof_of_reality_agent/attest/mock.py` for the demo and document the production path. The bundle schema is identical.
