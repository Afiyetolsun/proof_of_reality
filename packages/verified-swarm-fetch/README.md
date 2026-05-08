# @proof-of-reality/verified-swarm-fetch

Fetch from any Swarm gateway, **verify content-addressing client-side**. No node required.

The IPFS world has [`helia-verified-fetch`](https://github.com/ipfs/helia-verified-fetch). Swarm needed its own. This is a `fetch()`-shaped library that downloads from a Bee gateway and recomputes the chunk hash (or feed signature) the same way a Bee node would internally.

## Install

```bash
npm i @proof-of-reality/verified-swarm-fetch
```

## Usage

```ts
import { verifiedFetch } from "@proof-of-reality/verified-swarm-fetch";

const { data, verified, scope } = await verifiedFetch(reference, {
  gateway: "https://api.gateway.ethswarm.org",
});

if (!verified) throw new Error("Swarm gateway returned tampered content");
```

## Supports

- ✅ Single-chunk immutable blobs (≤4096 bytes) — full CAC verification (`keccak256(span || payload)`)
- 🚧 Multi-chunk immutable content — BMT verification (manifest + recursive chunk verification)
- 🚧 Feeds (mutable, SOC-backed) — signature recovery + owner match

## Design

- Browser + Node (uses `globalThis.fetch`, `Uint8Array`, no `Buffer`)
- No private keys / wallets needed for read-and-verify
- API mirrors `helia-verified-fetch` for cross-protocol familiarity
- Resilient: optional `permissive` flag returns `verified: false` instead of throwing on partial verification

## Submitted to

Swarm Verified Fetch bounty, ETHPrague 2026.

## License

MIT
