import Foundation

/// Sidecar written next to bundle.json after a successful /api/mint.
/// Read by ProofHistory to mark sessions as minted.
struct MintRecord: Codable, Hashable {
    let txHash: String
    let tokenId: String
    let ensName: String?
    let mintedAt: TimeInterval
    let stub: Bool?

    /// Basescan URL for the transaction. Returns nil if the mint was
    /// stubbed by the relay (no real on-chain tx exists yet).
    var explorerURL: URL? {
        if stub == true { return nil }
        return URL(string: "https://sepolia.basescan.org/tx/\(txHash)")
    }
}
