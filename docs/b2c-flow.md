# B2C flow — iOS scanner

User opens the iOS app, scans a thing, gets a Reality NFT.

## Sequence

```
User                iOS app                    Backend                Orbitport     Swarm    Base
 │                     │                          │                       │           │       │
 │ tap "Scan"          │                          │                       │           │       │
 ├────────────────────►│                          │                       │           │       │
 │                     │ POST /api/nonce          │                       │           │       │
 │                     ├─────────────────────────►│                       │           │       │
 │                     │                          │  ctrng.random()       │           │       │
 │                     │                          ├──────────────────────►│           │       │
 │                     │                          │  ◄──{ data, satSig }──│           │       │
 │                     │ ◄──{ value, satSig, … }──│                       │           │       │
 │                     │                          │                       │           │       │
 │                     │ render nonce as on-screen QR + chirp audio       │           │       │
 │                     │ start ARKit / ObjectCapture                      │           │       │
 │                     │ ... 8s capture ...                               │           │       │
 │                     │                                                  │           │       │
 │                     │ build bundle, compute deviceSigningHash          │           │       │
 │                     │ Secure Enclave sign (App Attest assertion        │           │       │
 │                     │   over the same hash)                            │           │       │
 │                     │                                                  │           │       │
 │                     │ POST /api/upload (multipart: scene + bundle)     │           │       │
 │                     ├──────────────────────────────────────────────────┼──────────►│       │
 │                     │                          │  kms.sign(hash)       │           │       │
 │                     │                          ├──────────────────────►│           │       │
 │                     │                          │  ◄──cosmoSig──────────│           │       │
 │                     │                          │  embed spaceFabric    │           │       │
 │                     │                          │  upload to /bzz x2    │           │       │
 │                     │ ◄──{ swarmRef, bundleRef, bundleHash, cosmoSig }─│           │       │
 │                     │                                                  │           │       │
 │                     │ POST /api/mint                                   │           │       │
 │                     ├─────────────────────────►│                       │           │       │
 │                     │                          │  RealityProof.mint(…) │           │       │
 │                     │                          ├──────────────────────────────────────────►│
 │                     │                          │  ◄──txHash────────────│           │       │
 │                     │ ◄──{ txHash, explorer }──│                       │           │       │
 │                     │                                                  │           │       │
 │ ◄── view NFT ───────│                                                  │           │       │
```

## What the iOS app holds

- Apple App Attest service (Apple's API; key never leaves Secure Enclave)
- The bearer token for the backend (`IOS_SHARED_SECRET`) — note this is NOT a crypto key, just a coarse "stop random internet" filter
- The pinned satellite pubkey (for client-side defense in depth — optional)

## What the iOS app does NOT hold

- Anything Orbitport-related (no client_id/secret)
- Anything Swarm-related (no postage)
- Anything wallet-related (no minter PK; the backend mints on the user's behalf)

## Bundle attestation block

```jsonc
"attestation": {
  "type": "appAttest",
  "appAttest": {
    "keyId": "…",
    "assertion": "base64-encoded App Attest assertion"
  }
}
```
