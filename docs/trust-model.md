# Trust model

## Threat model

We answer: **"Is this scan a real capture of the claimed object at the claimed time?"**

We do NOT answer:
- Is the *object itself* authentic? (That's a domain check the verifier adds.)
- Is the *operator's intent* honest? (Out of scope.)

## Trust roots

| Layer | What attests | Where the secret lives | Where the public anchor lives |
|---|---|---|---|
| **Time** | Cosmic nonce was issued by SpaceComputer Orbitport at issuance time | SpaceComputer satellite | Pinned `kmsPk` / sat pubkey in viewer |
| **Bundle integrity** | Bundle hash was witnessed by Space Fabric KMS in TEE | SpaceComputer KMS | Pinned `kmsPk` in viewer |
| **Device identity (B2B)** | Bundle hash was signed by registered hardware | USB Armory Mk II (ECDSA in DCP+OTPMK) | `DeviceRegistry` on-chain |
| **Device identity (B2C)** | Bundle hash was signed by App-Attested iOS app on a real iPhone | Apple Secure Enclave | Apple's CA chain |
| **Scene binding** | Cosmic nonce is visibly painted into the scene | — | OCR/QR detector in viewer |
| **Liveness** | Scene shows depth-coherent geometry, not a screen / photo | — | Anti-spoof classifier in viewer |

## Five-check verification

For a token at `/token/[id]` the viewer runs:

1. **Swarm CAC**: re-fetch bundle from Swarm, recompute chunk address, compare to `bundleRef`. Done by `verified-swarm-fetch`.
2. **Satellite sig**: verify `nonce.satSig.value` against pinned satellite pubkey over `nonce.value`.
3. **KMS cosig**: verify `spaceFabric.cosmoSig` against pinned KMS pubkey over `deviceSigningHash(bundle)`.
4. **Device** (one of):
   - **deviceSE**: `ecrecover` from `deviceSig` over `deviceSigningHash(bundle)` → address. Look up in `DeviceRegistry`. Confirm `org == proof.attestor`.
   - **appAttest**: parse Apple assertion, verify counter monotonicity + auth data + signature against the attested keypair's chain to Apple root.
5. **Scene + spoof**: OCR the nonce out of one or more rendered viewpoints; run anti-spoof classifier on the scene.

All five must pass for ✅. Yellow on (3) is acceptable while KMS is experimental.

## What an attacker can do

| Compromise | Consequence |
|---|---|
| Backend root | Drain Orbitport quota, drain Swarm postage, drain minter wallet. **Cannot forge real scans** — they don't have any signing key the verifier trusts. |
| iPhone with hostile app | App Attest fails (different bundle id / unattested key). Viewer rejects. |
| iPhone Secure Enclave extraction | Has not happened publicly. Threat model accepts this as "out of scope". |
| Camera root (Linux on OAK 4 D) | Cannot extract device key — it lives in the Armory's DCP+OTPMK. |
| USB Armory physical possession | Tamper-resistant; key would need DCP+OTPMK extraction (game over for the attacker). Stolen-camera mitigation: org revokes the device address in `DeviceRegistry`. |
| Stale nonce reuse | cTRNG nonces have a 10-minute validity window. After expiry the backend rejects upload. |
| Replay of an old bundle | `bundleHash` is unique by canonicalization; `RealityProof.mint` reverts on duplicate. |

## What we DON'T verify on-chain

To keep gas down, the contract is a dumb commit log:
- App Attest validation: too gas-heavy (X.509 chain to Apple root)
- Satellite sig verification: same — pubkey curves likely Ed25519/P-256, no native opcode
- KMS sig verification: same
- Anti-spoof: needs the actual scene bytes; on-chain impossible

All of these run off-chain in the viewer. The contract just commits to the proofs so they can't be retroactively changed.
