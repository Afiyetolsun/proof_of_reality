import Combine
import Foundation

/// Two-step submission used by the ProofSummaryView:
///   1. If the scene fits Vercel's 4.5 MB function payload, upload
///      bundle.json + scene.usdz to /api/upload — relay pins to Swarm
///      and returns swarmRef.
///   2. Otherwise keep the scene on device; swarmRef is a local:<sha>
///      pointer. The bundle hash is what's actually anchored on-chain,
///      so verifiers can still validate against the file once it's
///      shared out-of-band.
///   3. Either way, finish with /api/mint signed via App Attest.
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

    /// Conservative ceiling for the multipart payload we send to the
    /// Vercel relay. Vercel's hard cap is 4.5 MB on Hobby/Pro serverless
    /// functions; we pad the rest for bundle.json + multipart framing.
    private static let maxRelayPayload = 4 * 1024 * 1024

    init(api: APIClient = .shared) {
        self.api = api
        self.attest = AppAttestService()
    }

    /// Pre-loads the success state from an already-persisted mint.
    /// Used by ProofHistory to render past minted sessions without
    /// re-submitting them.
    func seed(mint: MintRecord) {
        phase = .done(mint)
    }

    func submit(payload: ProofSummaryPayload) async {
        do {
            let upload = try await resolveUpload(payload: payload)

            phase = .minting
            let assertionString = await attestationString(for: upload.bundleHash)
            let mintResponse = try await api.send(API.mint(payload: MintRequest(
                swarmRef: upload.swarmRef,
                bundleRef: "local:\(upload.bundleHash)",
                bundleHash: upload.bundleHash,
                satSig: payload.bundle.satSig,
                cosmoSig: "",
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

    /// Decides whether to push the scene through the relay or fall back
    /// to a local:<sha> pointer. Pure size-based — no probing of the
    /// remote, no timeouts.
    private func resolveUpload(payload: ProofSummaryPayload) async throws -> UploadResponse {
        let bundleBytes = (try? Data(contentsOf: payload.bundleURL).count) ?? 0
        let estimated = payload.bundle.scene.bytes + bundleBytes + 4_096

        guard estimated <= Self.maxRelayPayload else {
            return UploadResponse(
                swarmRef: "local:\(payload.bundle.scene.sha256)",
                bundleHash: payload.hash
            )
        }

        phase = .uploading
        return try await uploadBundle(payload: payload)
    }

    private func uploadBundle(payload: ProofSummaryPayload) async throws -> UploadResponse {
        var parts: [MultipartBuilder.Part] = []
        parts.append(try .file(name: "bundle", url: payload.bundleURL))
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
        let multipart = MultipartBuilder.make(parts: parts)
        return try await api.send(API.upload(multipart: multipart))
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
