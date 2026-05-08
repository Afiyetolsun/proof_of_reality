import CryptoKit
import DeviceCheck
import Foundation

/// Wraps Apple's DCAppAttestService so the proof bundle hash is signed
/// by the device's Secure Enclave. The verifier (Vercel relay) holds
/// the registered keyId and replays the attestation against Apple's
/// servers, then verifies each per-session assertion.
///
/// MVP flow used here:
///   1. generateAndAttest(challenge:) — once per install, registers a
///      fresh key and returns the attestation blob the backend stores.
///   2. assert(hash:) — once per scan, signs the bundle hash with the
///      registered key.
final class AppAttestService {

    enum AttestError: Error, LocalizedError {
        case unsupported
        case noStoredKey

        var errorDescription: String? {
            switch self {
            case .unsupported: return "App Attest is not supported on this device."
            case .noStoredKey: return "No App Attest key registered yet."
            }
        }
    }

    private let service = DCAppAttestService.shared
    private let keyIdDefault = "voxelio.appattest.keyId"

    var isSupported: Bool { service.isSupported }

    var registeredKeyId: String? {
        UserDefaults.standard.string(forKey: keyIdDefault)
    }

    /// One-time setup. `challenge` comes from the relay (`/api/attest/challenge`).
    /// On success, the attestation blob is sent back to the relay
    /// (`/api/attest/register`) which talks to Apple to confirm authenticity.
    func generateAndAttest(challenge: Data) async throws -> (keyId: String, attestation: Data) {
        guard service.isSupported else { throw AttestError.unsupported }
        let keyId = try await service.generateKey()
        let clientDataHash = Data(SHA256.hash(data: challenge))
        let attestation = try await service.attestKey(keyId, clientDataHash: clientDataHash)
        UserDefaults.standard.set(keyId, forKey: keyIdDefault)
        return (keyId, attestation)
    }

    /// Per-session signature over the canonical bundle hash. The relay
    /// passes this to the smart contract as the device-attestation proof.
    func assert(hash: String) async throws -> (keyId: String, assertion: Data) {
        guard service.isSupported else { throw AttestError.unsupported }
        guard let keyId = registeredKeyId else { throw AttestError.noStoredKey }
        let clientDataHash = Data(SHA256.hash(data: Data(hash.utf8)))
        let assertion = try await service.generateAssertion(keyId, clientDataHash: clientDataHash)
        return (keyId, assertion)
    }
}
