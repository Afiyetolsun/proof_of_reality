# Pitch (90 seconds)

> Proof of Reality is a **physical-world attestation network**. Today, NFTs prove digital ownership. Nothing proves a 3D scan is a real capture of a real thing — until now.
>
> Every Reality NFT carries three independent witnesses. **One** — a cosmic random nonce, signed by a satellite in orbit, painted into the scene at capture time. **Two** — the bundle hash, co-signed by SpaceComputer's Space Fabric KMS, witnessing that the bundle existed before mint. **Three** — the bundle hash, signed by hardware that can't be cloned: an iPhone's Secure Enclave for consumers, a USB Armory Mk II for enterprise capture stations on Luxonis OAK 4 D cameras.
>
> Two clients. One trust pipeline. The org publicly stakes its reputation on every device through a permissionless on-chain registry. We don't replace verifier judgment — we anchor it. Across atmosphere, hardware, and chain.
>
> [Demo: trigger an OAK 4 D capture on stage. 20 seconds later, a basescan link appears on a kiosk screen. Scan the QR with an iPhone — the viewer renders the scan and shows five green checks.]
>
> The hardware is real. The trust is auditable. The infrastructure is permissionless.
> ETHPrague's Solarpunk theme isn't a metaphor for us — it's literally what we built.

## Bullet version

- Web3 oracle for the physical world
- Two paths: B2C iPhone, B2B Luxonis OAK 4 D + USB Armory Mk II
- Three trust roots: SpaceComputer satellite cTRNG, Space Fabric KMS cosig, hardware-resident device key
- Five-check verification in the viewer
- Permissionless on-chain device registry — orgs publicly stake reputation
- Bounty stack: SpaceComputer ($6k) + Swarm Verified Fetch ($250) + ENS

## What to actually demo on stage

1. **The B2C path live**: scan a small object with the iPhone in 30 seconds, watch it mint
2. **The B2B path live**: press a button on the OAK 4 D, watch the kiosk show the basescan link
3. **The viewer**: scan the QR from the kiosk, show the five checks turn green one by one
4. **The threat scenario**: claim "I'll fake a scan from my laptop right now" — try, and watch the device registry lookup fail
5. **The pitch line**: "Same proof bundle, two trust roots, three independent witnesses, one viewer."

## Backup if something breaks

- iPhone fails: pre-recorded video of the iOS flow, narrate over it
- OAK 4 D fails: same — pre-recorded
- Backend fails: don't pitch — fix it. Backend is the demo critical path.
- Swarm fails: `STORAGE_BACKEND=ipfs` Pinata fallback
- KMS fails: cosmoSig is null but `experimental: true` flag — viewer shows yellow check, pitch acknowledges KMS is experimental
