import Combine
import Foundation

/// Two-step submission used by the ProofSummaryView.
///
///   Small scenes (≤ ~4 MB):
///     1. POST bundle.json + scene to /api/upload — relay pins to Swarm,
///        returns swarmRef + cosmoSig.
///
///   Big scenes (> ~4 MB, e.g. Object Capture USDZ ~6-20 MB):
///     1a. POST scene directly to the VPS Bee at /bzz — returns swarmRef.
///     1b. POST bundle.json only to /api/upload (no scene part) —
///         returns cosmoSig (the KMS co-sig on bundleHash, which only
///         the backend can produce).
///
///   2. Either way, finish with /api/mint carrying real swarmRef +
///      real cosmoSig + the App Attest assertion.
///
/// Vercel's body limit is 4.5 MB on Hobby/Pro; Bee has no such limit.
/// Splitting the upload keeps Vercel out of the hot path for bytes
/// while preserving the bundleHash + cosmoSig flow that gates the mint.
@MainActor
final class ProofSubmitter: ObservableObject {

    enum Phase: Equatable {
        case idle
        case uploading
        case minting
        case done(MintRecord)
        case failed(String)
    }

    @Published private(set) var phase: Phase = .idle

    private let api: APIClient
    private let attest: AppAttestService
    private let swarmDirect: SwarmDirectUploader

    /// Conservative ceiling for the multipart payload we send to the
    /// Vercel relay. Vercel's hard cap is 4.5 MB on Hobby/Pro serverless
    /// functions; we pad the rest for bundle.json + multipart framing.
    private static let maxRelayPayload = 4 * 1024 * 1024

    init(api: APIClient = .shared,
         swarmDirect: SwarmDirectUploader = SwarmDirectUploader()) {
        self.api = api
        self.attest = AppAttestService()
        self.swarmDirect = swarmDirect
    }

    /// Pre-loads the success state from an already-persisted mint.
    /// Used by ProofHistory to render past minted sessions without
    /// re-submitting them.
    func seed(mint: MintRecord) {
        phase = .done(mint)
    }

    func submit(payload: ProofSummaryPayload) async {
        do {
            let resolved = try await resolveUpload(payload: payload)

            phase = .minting
            let assertionString = await attestationString(for: resolved.bundleHash)
            let mintResponse = try await api.send(API.mint(payload: MintRequest(
                swarmRef: resolved.swarmRef,
                bundleRef: "local:\(resolved.bundleHash)",
                bundleHash: resolved.bundleHash,
                satSig: payload.bundle.satSig,
                cosmoSig: resolved.cosmoSig ?? "",
                attestation: assertionString,
                attestationType: 0,
                capturedAt: Int(payload.bundle.createdAt),
                mode: payload.mode.contractValue
            )))

            let record = MintRecord(
                txHash: mintResponse.txHash,
                tokenId: mintResponse.tokenId,
                ensName: mintResponse.ensName,
                mintedAt: Date().timeIntervalSince1970,
                stub: mintResponse.stub
            )
            persistMint(payload: payload, record: record)
            phase = .done(record)
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    /// Internal carrier — what we hand to the mint step. swarmRef is
    /// always populated (Bee-direct or via relay); cosmoSig is whatever
    /// the relay returned, or nil when offline-only.
    private struct ResolvedUpload {
        let swarmRef: String
        let bundleHash: String
        let cosmoSig: String?
    }

    /// Picks the right upload path based on scene size:
    ///   - small (≤ maxRelayPayload): single relay round-trip, scene + bundle
    ///   - big (> maxRelayPayload): Bee-direct for the scene + relay for bundle
    private func resolveUpload(payload: ProofSummaryPayload) async throws -> ResolvedUpload {
        let bundleBytes = (try? Data(contentsOf: payload.bundleURL).count) ?? 0
        let estimated = payload.bundle.scene.bytes + bundleBytes + 4_096

        phase = .uploading

        if estimated <= Self.maxRelayPayload {
            let upload = try await uploadBundle(payload: payload, includeScene: true)
            // For the small-scene path the relay must have given us
            // a swarmRef; if it didn't something's wrong server-side.
            guard let swarmRef = upload.swarmRef, !swarmRef.isEmpty else {
                throw NSError(
                    domain: "ProofSubmitter",
                    code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "Relay didn't return swarmRef for small scene"]
                )
            }
            return ResolvedUpload(
                swarmRef: swarmRef,
                bundleHash: upload.bundleHash,
                cosmoSig: upload.cosmoSig
            )
        }

        // Big scene: upload directly to Bee, then call /api/upload with
        // bundle-only to harvest cosmoSig.
        let sceneURL = payload.bundleURL
            .deletingLastPathComponent()
            .appendingPathComponent(payload.bundle.scene.name)
        let sceneRef = try await swarmDirect.upload(
            fileURL: sceneURL,
            filename: payload.bundle.scene.name,
            contentType: mime(for: payload.bundle.scene.name)
        )

        let bundleOnly = try await uploadBundle(payload: payload, includeScene: false)
        return ResolvedUpload(
            swarmRef: sceneRef,
            bundleHash: bundleOnly.bundleHash,
            cosmoSig: bundleOnly.cosmoSig
        )
    }

    /// POST to /api/upload. When `includeScene` is false we only send the
    /// bundle.json part — the relay returns a null swarmRef but still
    /// produces bundleHash + cosmoSig.
    private func uploadBundle(payload: ProofSummaryPayload,
                              includeScene: Bool) async throws -> UploadResponse {
        var parts: [MultipartBuilder.Part] = []
        parts.append(try .file(name: "bundle", url: payload.bundleURL))
        if includeScene {
            let sceneURL = payload.bundleURL
                .deletingLastPathComponent()
                .appendingPathComponent(payload.bundle.scene.name)
            parts.append(try .file(name: "scene", url: sceneURL))
            if let audio = payload.bundle.audio {
                let audioURL = payload.bundleURL
                    .deletingLastPathComponent()
                    .appendingPathComponent(audio.name)
                if FileManager.default.fileExists(atPath: audioURL.path) {
                    parts.append(try .file(name: "audio", url: audioURL))
                }
            }
        }
        let multipart = MultipartBuilder.make(parts: parts)
        return try await api.send(API.upload(multipart: multipart))
    }

    private func mime(for filename: String) -> String {
        let ext = (filename as NSString).pathExtension.lowercased()
        switch ext {
        case "usdz": return "model/vnd.usdz+zip"
        case "glb":  return "model/gltf-binary"
        case "gltf": return "model/gltf+json"
        case "obj":  return "text/plain"
        default:     return "application/octet-stream"
        }
    }

    private func persistMint(payload: ProofSummaryPayload, record: MintRecord) {
        let url = payload.bundleURL.deletingLastPathComponent()
            .appendingPathComponent("mint.json")
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try? encoder.encode(record).write(to: url)
    }

    private func attestationString(for hash: String) async -> String {
        if let result = try? await attest.assert(hash: hash) {
            return result.assertion.base64EncodedString()
        }
        // Falls back when running on Simulator / no entitlement / first run
        // before bootstrap. Backend treats this as untrusted.
        return "MOCK"
    }
}
