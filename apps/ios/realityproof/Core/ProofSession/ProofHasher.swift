import CryptoKit
import Foundation

enum ProofHasher {

    static func canonicalEncode<T: Encodable>(_ value: T) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return try encoder.encode(value)
    }

    static func sha256(of data: Data) -> String {
        SHA256.hash(data: data).hex
    }

    static func sha256(of fileURL: URL) throws -> (sha: String, bytes: Int) {
        let handle = try FileHandle(forReadingFrom: fileURL)
        defer { try? handle.close() }

        var hasher = SHA256()
        var totalBytes = 0
        let chunkSize = 1 << 16
        while autoreleasepool(invoking: {
            let chunk = try? handle.read(upToCount: chunkSize)
            guard let chunk, !chunk.isEmpty else { return false }
            hasher.update(data: chunk)
            totalBytes += chunk.count
            return true
        }) {}

        return (hasher.finalize().hex, totalBytes)
    }

    /// Hashes the canonical-encoded bundle. This is what's signed by App
    /// Attest and what the smart contract receives as `bundleHash`.
    static func hash(_ bundle: ProofBundle) throws -> String {
        let data = try canonicalEncode(bundle)
        return sha256(of: data)
    }
}

extension Sequence where Element == UInt8 {
    fileprivate var hex: String {
        map { String(format: "%02x", $0) }.joined()
    }
}
