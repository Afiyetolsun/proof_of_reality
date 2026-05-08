# gotee-applet — Sign hashes inside ARM TrustZone Secure World

This is the Rust [GoTEE](https://github.com/usbarmory/GoTEE) trusted applet
that the [USB Armory MK II](https://github.com/usbarmory/usbarmory) runs to
sign scan hashes for `oak-scan-and-sign`.

The applet runs in **Secure World user mode** on an i.MX6ULL SoC. The host
talks to it over a TCP/JSON bridge on `10.0.0.1:4000` (USB-CDC-ECM):

```
{"Method":"Sign","Input":"<hex payload>"}
   →
{"Output":"{\"device_id\":\"...\",\"nonce\":\"...\",\"mac\":\"...\"}"}
```

- `device_id` — first 8 bytes of `SHA256(derived_key)`, hex
- `nonce` — 16 bytes from the hardware RNG (`SYS_GETRANDOM`), hex
- `mac` — `HMAC-SHA256(derived_key, payload || nonce)`, hex

`derived_key` comes from `RPC.Attest(true)` — the Trusted OS uses the
on-die DCP (or CAAM on i.MX6UL) for hardware key derivation. **The key
never leaves Secure World**; only the MAC and a SHA-256 fingerprint of
the key are exposed.

A given Armory MK II will always produce the same `device_id` and the same
MAC for the same `(payload, nonce)` — that's what makes it a usable
hardware identity.

## Build & flash

This file isn't built standalone. Drop it into the
[gotee_starter](https://github.com/usbarmory/usbarmory) hackathon scaffold:

```bash
cd <gotee_starter>
cp <oak-scan-and-sign>/gotee-applet/sign_hash.rs src/main.rs
# add to docker/Cargo.toml [dependencies]:
#   sha2 = { version = "0.10", default-features = false }
#   hmac = { version = "0.12", default-features = false }
make applet                                       # cross-compile via cargo
bun run upload target/armv7a-none-eabi/release/trusted_applet
./scripts/armory-link.sh                          # macOS drops the link on reset
printf '{"Method":"Sign","Input":"deadbeef"}\n' | nc 10.0.0.1 4000
```

The Trusted OS already running on the Armory hot-swaps the new applet to
SD byte 32 MB and watchdog-resets — no SD reflash required.
