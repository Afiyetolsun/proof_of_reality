# ProofBundle — canonical schema reference

The `ProofBundle` is the single document that captures everything about a scan. It gets:

1. Built by the client (iOS or camera agent)
2. Signed by hardware (Secure Enclave or USB Armory)
3. Co-signed by SpaceComputer KMS (added by backend)
4. Hashed (`bundleHash`) and pinned on-chain via `RealityProof.mint`
5. Stored as canonical JSON on Swarm (referenced by `bundleRef`)
6. Re-fetched and re-verified by the viewer at `/token/[id]`

## Schema

See `packages/proof-bundle/src/schema.ts` for the authoritative zod definition.

```jsonc
{
  "version": "1.0",
  "mode": "roomPlan" | "objectCapture" | "stereoFusion",
  "device": {
    "model": "iPhone15,3" | "OAK-4-D",
    "os": "iOS 17.5" | "luxonis-os/5.15",
    "appVersion": "0.1.0"
  },
  "capture": {
    "startedAt": 1746567620,
    "endedAt": 1746567681,
    "frames": 420,
    "sceneFormat": "usdz" | "ply" | "glb" | "obj"
  },
  "nonce": {
    "value":     "0x…",
    "src":       "trng" | "rng" | "ipfs",
    "satSig":    { "value": "0x…", "pk": "0x…" },
    "issuedAt":  1746567619,
    "binding":   ["visualQR", "audioTTS", "sensorSeed"]
  },
  "spaceFabric": {
    "cosmoSig":  "0x…" | null,
    "kmsPk":     "0x…" | null,
    "kmsKeyId":  "…"   | null,
    "experimental": true
  },
  "sensors": {
    "imu":  "swarm-ref-or-inline-base64",
    "gps":  { "lat": 50.087, "lon": 14.420, "alt": 215.3, "hAcc": 4.1 },
    "baro": 101.32
  },
  "attestation": {
    // Discriminated by `type`
    "type": "appAttest" | "deviceSE",

    // when type=appAttest
    "appAttest": { "keyId": "…", "assertion": "base64…" },

    // when type=deviceSE
    "deviceSE": {
      "deviceAddr":         "0x…",
      "deviceSig":          "0x…",
      "vendor":             "usb-armory-mk2" | "atecc608" | "se05x",
      "vendorAttestation":  "…"
    }
  }
}
```

## Hash discipline

| Hash | What it covers | Used for |
|---|---|---|
| `deviceSigningHash(bundle)` | Bundle minus `spaceFabric` block | Device hardware key signs THIS |
| `bundleHash(bundle)` | Full canonical bundle (with `cosmoSig` populated) | What gets stored on-chain |

The two-hash design lets the device sign before knowing the KMS co-signature (the device signs first, then the backend co-signs). Verifier reproduces both.

## Canonicalization

RFC 8785 (JCS) subset. Implemented byte-identically in:

- TypeScript — `packages/proof-bundle/src/canonical.ts`
- Python — `apps/camera-agent/src/proof_of_reality_agent/canonical.py`
- Swift — to be written in `apps/ios/.../Canonical.swift`

**Cross-language fixture test required.** When the schema changes, regenerate the fixture and verify all three implementations produce the same `bundleHash`.

## Versioning

Top-level `"version": "1.0"`. Bump on any breaking schema change. Verifier rejects unknown versions.
