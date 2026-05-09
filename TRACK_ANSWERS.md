# Track Fit — ETHPrague 2026 Submission

Answers to *"Explain how your project fits into this track"* for each applied track.

Project: **Proof of Reality** (with **oak-scan-and-sign** as the B2B hardware capture station).

---

## 1. SpaceComputer ($6,000)

SpaceComputer is the spine of this project, not a logo on a slide. Every Reality NFT we mint embeds two independent SpaceComputer-rooted signatures, both verifiable client-side against pinned pubkeys.

The first is **satSig**. The iPhone (or the OAK4 station) pulls a cTRNG nonce from Orbitport before capture, the satellite signs it, and the device paints the value into the scene as a QR plus audio overlay. The signature pins the scan to a moment in time the attacker cannot precompute or roll back.

The second is **cosmoSig**. Every bundle hash gets co-signed by Space Fabric KMS in TEE. The order of operations is fixed in **apps/api/src/routes/upload.routes.ts**: verify the device signature, KMS co-sign the **deviceSigningHash**, embed the **spaceFabric** block, recompute the final **bundleHash**. The KMS pubkey is pinned in the viewer (**docs/trust-model.md**), so verification runs without trusting our backend at all.

Both signatures are committed on-chain via **RealityProof.mint(...)** on Base Sepolia, so they cannot be retroactively swapped. If our backend is fully compromised, the attacker can drain Orbitport quota, Swarm postage, and gas. They cannot forge a scan, because they hold neither the satellite's key nor the KMS's key.

We use Orbitport as the temporal anchor and Space Fabric as the integrity anchor, exactly as they were designed: cryptographic ground truth for an oracle that bridges the physical world onto Ethereum.

---

## 2. ENS — Most Creative Use ($2,000)

Each Reality NFT publishes its own ENS subname on Sepolia: **vin-<bundleHash[2:14]>.realityproof.eth**. The handle is not decoration. It is how the proof is shared.

Records on each subname carry the full commitment:

- **addr** resolves to the attestor wallet
- **contenthash** is an ENSIP-7 Swarm reference to the canonical bundle JSON
- text records hold **bundleHash**, **satSig**, **cosmoSig**, **capturedAt**, **tokenId**, **mode**, **url**, **avatar**

A verifier holding only the ENS handle can fetch the bundle (Brave, MetaMask, eth.link all resolve ENSIP-7 contenthash natively), recompute the canonical hash, and check the five signatures. They do not need our contract address, our backend, or our app to be online.

That is the creative use: ENS is not a vanity wrapper around an NFT URL. It is the canonical, wallet-native, infrastructure-agnostic sharing surface for an off-chain proof. The contract is a commit log. The bundle lives on Swarm. The ENS name is the human-readable handle that ties them together. If our company disappears tomorrow, the proof remains resolvable.

A demo script (**apps/api/scripts/verify-ens.ts**) walks any judge through resolving a live mint to its records, end to end, in one terminal command.

---

## 3. Swarm — Verified Fetch ($250)

We shipped **@proof-of-reality/verified-swarm-fetch**, a **fetch()**-shaped library that downloads from any Bee gateway and recomputes the chunk address client-side before returning the bytes. The IPFS world has **helia-verified-fetch**. Swarm needed its own. We wrote it.

```ts
const { data, verified, scope } = await verifiedFetch(reference, {
  gateway: "https://api.gateway.ethswarm.org",
});
if (!verified) throw new Error("gateway tampered");
```

It runs in browser and Node, no Bee node required, no private keys, no Buffer dependency. Single-chunk CAC (**keccak256(span || payload)**) is fully verified today. Multi-chunk BMT and SOC feed verification are scoped next.

The library is load-bearing for the rest of the project. Every scan is uploaded to Swarm through our self-hosted Bee node (**infra/swarm/**), with postage stamps purchased on Gnosis. The viewer's first verification check uses **verified-swarm-fetch** to refetch the bundle and confirm the gateway returned exactly what was addressed. If the gateway lies, the library catches it and the scan fails verification.

It is published to npm under MIT so anyone else building on Swarm can drop it in. That was the point of the bounty as we read it: trust no gateway, and make it easy for the next team not to trust their gateway either.

---

## 4. Sourcify ($4,000)

Both production contracts (**RealityProof.sol** ERC-721 + on-chain proof commitments, and **DeviceRegistry.sol** permissionless B2B device registry) are verified on Sourcify with source pinned to IPFS.

Sourcify is the right verifier for this project specifically. Our entire proposition is decentralization of trust: a pinned satellite pubkey, a pinned KMS pubkey, a content-addressed Swarm reference, an on-chain commit log. Verifying the contract source through a centralized service like Etherscan would have been an embarrassing trust-root mismatch. Sourcify keeps the contract bytecode auditable in the same trust envelope as everything else: cryptographic, public, gateway-independent.

Verification is wired into **pnpm deploy:sepolia**. A redeploy fails CI if Sourcify cannot recompute identical bytecode from the pinned source, so the address that lands in **apps/api/.env** is, by construction, the address whose source any judge can audit independently. The deployment notes live in **docs/private/deployments.md** (kept private only because they include the non-load-bearing testnet wallet, not the source).

---

## 5. ETHPrague — Best Hardware Usage ($500)

This project is hardware-first by design. Three independent hardware roots of trust, two capture frontends, one shared **ProofBundle** schema:

**Apple Secure Enclave** (B2C). The iPhone app uses App Attest to bind a per-device key inside the Secure Enclave to a verified iOS bundle. Unattested keys fail validation in the viewer's chain check against Apple's CA root.

**USB Armory Mk II** (B2B). An i.MX6ULL HSM running a GoTEE Trusted Applet (**oak-scan-and-sign/gotee-applet/sign_hash.rs**). The applet HMAC-SHA256s scan hashes with a key derived inside Secure World using DCP + OTPMK. The private half never crosses the security boundary, even with full Linux root on the host camera.

**Luxonis OAK4** (B2B capture). RVC4 / Qualcomm Kalama. The recorder runs in an oakapp container on the camera itself, captures synchronised RGB plus depth frames at 10 fps, runs Open3D RGB-D odometry and **ScalableTSDFVolume** integration on-device, and ships the resulting PLY hash over a CDC-Ethernet bridge (**scripts/forwarder.py**) to the Armory for signing.

The hardware does work no software-only stack can replicate: it pins a scan to a specific physical device whose key cannot be exfiltrated to a server farm. The **oak-scan-and-sign** proof tier system (**cosmic+token** down to **space**) gracefully degrades based on which hardware is reachable, with **space*** tiers persisting locally and replaying through **POST /retry-mint/{scan_id}** once the network returns. The strongest path uses every layer.

---

## 6. ETHPrague — Future Society ($2,500)

A Solarpunk future needs cryptographic ground truth about the physical world. Which solar array exists. Which battery actually holds the capacity it claims. Which carbon-credit forest is a forest, and not a satellite-image overlay. Most of today's RWA, DePIN, and impact-finance protocols collapse onto a single trusted operator who promises the physical thing is real.

We replace that operator with a structural alternative: three independent hardware-rooted witnesses (satellite cTRNG, KMS co-sig, on-device key) plus a permissionless on-chain device registry where any organization can publicly stake reputation by registering its capture devices. No central authority issues the truth. The truth is a recomputable hash, signed by parties with public keys, anchored to a moment in time the operator did not get to choose.

The infrastructure stack carries the same values down to the bottom layer. Storage is Swarm (self-hosted Bee), not S3. Randomness is Orbitport, not a centralized RNG. Device identity is hardware, not a SaaS API. Contract source is verified on Sourcify, not a single-operator dashboard. A Reality NFT is durable in the strict sense: if we disappear tomorrow, the bundle is still on Swarm, the ENS name still resolves, the contract is still on Base, and the proof is still verifiable from a laptop.

The Solarpunk theme isn't a metaphor we borrowed for the pitch. It is the literal scope of the system.

---

## 7. ETHPrague — Best Privacy by Design ($500)

Privacy here is structural. The trust model is laid out row-by-row in **docs/trust-model.md**, and three properties carry it:

**Keys live in hardware, full stop.** The B2C device key lives in the iPhone Secure Enclave. The B2B device key lives in the USB Armory's DCP + OTPMK. Neither is transmitted, exported, or escrowed. Even physical possession of the Armory does not yield the key without DCP + OTPMK extraction, which is game-over for the attacker, not for us.

**Backend as economic proxy, not trust root.** The backend holds exactly three secrets: an Orbitport client secret, a Swarm postage batch ID, a minter hot-wallet PK. That is the entire blast radius of a backend compromise. The attacker drains gas, postage, and API quota. They cannot impersonate a user, cannot forge a scan, cannot decrypt anyone's data. The cryptographic trust roots (KMS pubkey, satellite pubkey, device addresses on-chain) are public and pinned in clients.

**No off-device PII pipeline.** Scenes and bundles go straight to Swarm, addressed by content. No user account. No email. No telemetry. The only identifier per scan is a wallet address, scoped further into a per-mint ENS subname rather than a global account handle. Logs redact assertions, signatures, and any hex string that smells like a key (**apps/api/src/utils/logger.ts**).

The compromise table reads cleanly: every threat row ends in "drains money" or "rejected by viewer." None ends in "forges a real scan."

---

## 8. ETHPrague — Best UX Flow ($500)

The B2C capture flow is sub-30-seconds, end to end, with no account screen.

1. Open the app, tap Object, scan a small object on a table for around 30 seconds (LiDAR plus RealityKit Object Capture).
2. Tap Submit Proof. The phone fetches the cosmic nonce, paints it into the scene as a QR, speaks it into the audio track, hashes the bundle, and signs it with the Secure Enclave.
3. The backend co-signs with KMS, uploads scene plus bundle to Swarm, mints the ERC-721 on Base Sepolia, and publishes a per-mint ENS subname on Sepolia. Around 10 seconds.
4. The success card exposes three taps: Basescan (the on-chain proof), ENS (**vin-<hash>.realityproof.eth** resolving to all records), and a share sheet that emits the bundle JSON ready for offline verification.

The verifier flow is the inverse, equally short. Open the ENS handle in any wallet. ENS resolves the Swarm contenthash. The viewer fetches the bundle through **verified-swarm-fetch**, runs five checks, and turns each green as it passes.

The choice we are most pleased with: the first thing the user does is the thing the product does. There is no waitlist, no onboarding modal, no email collection. The first thing a verifier sees is the proof, not a marketing page. No section of either flow asks the user to read more than a sentence at a time.

---

## 9. ETHPrague — Network Economy ($2,500)

Proof of Reality is itself a small network economy with three roles, each with a clear incentive.

**Capture operators** (organizations running B2B OAK4 stations or fleets of B2C iPhones) register their devices in a permissionless on-chain **DeviceRegistry.sol**. Registration is a public stake of reputation: every scan a device produces is signed by it, and every signature is traceable on-chain back to the registering org. There is no gatekeeper. A used-car dealership, a logistics company, an insurance adjuster, or a citizen-science collective registers under the same contract on the same terms.

**Verifiers** (marketplaces, RWA protocols, DePIN orchestrators, KYC officers) consume scans for free, but their economic question is no longer "do I trust the listing photo." It becomes "is the bundle hash committed on-chain, do the five signatures verify, is the signing device registered to an org I'm willing to credit." That moves the trust decision from human judgment about a stock photo to a deterministic check against public infrastructure.

**Asset holders** (the people who scanned the thing) get a transferable on-chain artifact, the Reality NFT, that travels with the object across marketplaces, custody changes, and protocol boundaries. The proof is durable independent of any single operator: bundle on Swarm, name on ENS, contract on Base, source on Sourcify.

The economic primitive we are adding is "proof of physical existence at a moment in time." Today's RWA and DePIN networks assume this primitive and outsource it to a single trusted operator. We make it a public good, secured by hardware and a satellite, and route incentives so capture operators are rewarded for honest scans and slashable (via on-chain registry revocation) for fraudulent ones. The backend is a thin economic proxy that collects gas, postage, and Orbitport quota, not value.

The result is the missing settlement layer for any network whose economic claims depend on something physical existing. That is the Network Economy contribution.
