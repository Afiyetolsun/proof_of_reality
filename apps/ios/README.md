# Proof of Reality — iOS scanner (B2C)

Swift / SwiftUI / RealityKit / ARKit. Created in Xcode by the iOS dev — this directory exists so the monorepo has a clear home for it.

## Suggested layout (when the dev creates the project)

```
ProofOfReality.xcodeproj
ProofOfReality/
├── App/
│   ├── ProofOfRealityApp.swift
│   └── ContentView.swift
├── Capture/
│   ├── ObjectCaptureView.swift   # for objectCapture mode
│   ├── RoomPlanView.swift        # for roomPlan mode
│   └── BundleBuilder.swift       # ProofBundle assembly
├── Attest/
│   ├── AppAttestService.swift    # Apple App Attest helper
│   └── BundleSigner.swift        # Secure Enclave sign over deviceSigningHash
├── Net/
│   └── ProofApiClient.swift      # /api/nonce, /api/upload, /api/mint
├── Crypto/
│   └── Canonical.swift           # MUST match packages/proof-bundle byte-for-byte
└── UI/
    └── …
```

## Trust model parity with B2B

- iPhone Secure Enclave key signs `deviceSigningHash(bundle)` — same role as USB Armory on the camera
- Apple App Attest assertion replaces `deviceSE` attestation block with `appAttest`
- Same `ProofBundle` schema, same backend endpoints, same on-chain commitment

## Critical: canonicalization parity

The Swift `Canonical.swift` file must produce **byte-for-byte identical** output to:

- `packages/proof-bundle/src/canonical.ts` (TypeScript)
- `apps/camera-agent/src/proof_of_reality_agent/canonical.py` (Python)

Test fixture-driven equality across all three. Drift here = every iOS scan fails verification.

## Configuration

The iOS app needs:

- Backend base URL → `Info.plist` or `xcconfig`
- `IOS_SHARED_SECRET` → Bearer token for the backend (NOT a crypto key — see backend README)
- Bundle ID for App Attest

## Trust root parity

The iOS path uses Apple App Attest **plus** SpaceComputer KMS co-signature (added by the backend). That gives the B2C path the same Space Fabric trust root as the B2B path — same `ProofBundle` shape, same backend endpoints, same on-chain commitment.
