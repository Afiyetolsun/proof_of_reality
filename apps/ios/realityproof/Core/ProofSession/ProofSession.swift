import Combine
import Foundation

/// Orchestrates a single capture: gets a cosmic nonce, runs the sensor +
/// audio binders for the duration of the scan, and assembles the proof
/// bundle when the scene is on disk.
@MainActor
final class ProofSession: ObservableObject {

    enum Phase: Equatable {
        case idle
        case fetchingNonce
        case ready
        case capturing
        case bundling
        case done(hash: String, bundleURL: URL)
        case failed(String)
    }

    @Published private(set) var phase: Phase = .idle
    @Published private(set) var nonce: NonceResponse?
    @Published private(set) var folder: URL?
    @Published private(set) var lastBundle: ProofBundle?

    private let api: APIClient
    private let sensors = SensorLogger()
    private let audio = NonceAudioBinder()

    init(api: APIClient = .shared) { self.api = api }

    /// Pulls a nonce from the relay (or generates a local mock when the
    /// relay isn't reachable — useful while the backend is still being
    /// wired up). Allocates a session folder for capture artefacts.
    func prepare() async {
        phase = .fetchingNonce
        do {
            folder = try ProofStorage.sessionFolder()
            let response = try await api.send(API.nonce())
            nonce = response
            phase = .ready
        } catch {
            // Fallback so the rest of the pipeline can be exercised
            // without a live relay. This path is the loud "I'm not real"
            // signal — a real proof is never built off a local nonce.
            nonce = NonceResponse(
                nonce: Self.localMockNonce(),
                satSig: "MOCK",
                expiresAt: Date().addingTimeInterval(120).timeIntervalSince1970
            )
            if folder == nil {
                folder = try? ProofStorage.sessionFolder()
            }
            phase = .ready
        }
    }

    /// Starts the audio + sensor binders. Call after `prepare()` returns
    /// `.ready` and before the capture view enters its scanning state.
    func startBinding() {
        guard let nonce, let folder else { return }
        sensors.start(nonce: nonce.nonce)
        try? audio.start(nonce: nonce.nonce, to: folder)
        phase = .capturing
    }

    /// Stops binders and assembles the bundle. Returns the bundle hash
    /// + URL via the `phase` transition.
    func finalize(mode: ScanMode, sceneURL: URL) {
        guard let nonce, let folder else {
            phase = .failed("No active session")
            return
        }
        phase = .bundling

        let record = sensors.stop()
        audio.stop()

        do {
            let result = try ProofBundleBuilder.build(inputs: .init(
                mode: mode,
                nonceResponse: nonce,
                sceneURL: sceneURL,
                audioURL: audio.recordingURL,
                sensorRecord: record,
                folder: folder
            ))
            lastBundle = result.bundle
            phase = .done(hash: result.hash, bundleURL: result.bundleURL)
        } catch {
            phase = .failed("Bundle build failed: \(error.localizedDescription)")
        }
    }

    func cancel() {
        _ = sensors.stop()
        audio.stop()
        phase = .idle
    }

    private static func localMockNonce() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return bytes.map { String(format: "%02x", $0) }.joined()
    }
}
