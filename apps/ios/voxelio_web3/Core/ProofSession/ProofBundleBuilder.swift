import Foundation

/// Builds a ProofBundle from the artefacts a capture session leaves on
/// disk + the nonce response from Orbitport + the recorded sensor stream.
enum ProofBundleBuilder {

    struct Inputs {
        let mode: ScanMode
        let nonceResponse: NonceResponse
        let sceneURL: URL
        let audioURL: URL?
        let sensorRecord: SensorLogger.Record
        let folder: URL
    }

    /// Writes the canonical-encoded bundle.json into the session folder
    /// next to the scene/audio/sensor files and returns it together with
    /// its hash.
    static func build(inputs: Inputs) throws -> (bundle: ProofBundle, hash: String, bundleURL: URL) {
        let scene = try ProofHasher.sha256(of: inputs.sceneURL)
        var audioRef: ProofBundle.FileRef?
        if let audioURL = inputs.audioURL,
           FileManager.default.fileExists(atPath: audioURL.path) {
            let result = try ProofHasher.sha256(of: audioURL)
            audioRef = ProofBundle.FileRef(name: audioURL.lastPathComponent,
                                           sha256: result.sha, bytes: result.bytes)
        }

        let sensorData = try ProofHasher.canonicalEncode(inputs.sensorRecord)
        let sensorURL = inputs.folder.appendingPathComponent("sensors.json")
        try sensorData.write(to: sensorURL)

        let bundle = ProofBundle(
            version: 1,
            mode: inputs.mode.rawValue,
            createdAt: Date().timeIntervalSince1970,
            nonce: inputs.nonceResponse.nonce,
            satSig: inputs.nonceResponse.satSig,
            nonceExpiresAt: inputs.nonceResponse.expiresAt,
            scene: ProofBundle.FileRef(
                name: inputs.sceneURL.lastPathComponent,
                sha256: scene.sha, bytes: scene.bytes
            ),
            audio: audioRef,
            sensorsHash: ProofHasher.sha256(of: sensorData),
            device: .current()
        )

        let hash = try ProofHasher.hash(bundle)
        let bundleURL = inputs.folder.appendingPathComponent("bundle.json")
        try ProofHasher.canonicalEncode(bundle).write(to: bundleURL)

        return (bundle, hash, bundleURL)
    }
}
