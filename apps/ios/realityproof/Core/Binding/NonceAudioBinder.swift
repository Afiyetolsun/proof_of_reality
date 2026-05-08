import AVFoundation
import Foundation

/// Speaks the cosmic nonce out loud during a scan so it ends up in the
/// ambient audio of the device while the user hears it.
///
/// We deliberately do NOT mutate AVAudioSession or run an AVAudioRecorder
/// here — RoomCaptureView (ARKit) and ObjectCaptureSession (RealityKit)
/// own the audio session for the duration of the scan, and contending
/// for it caused ARKit SLAM to fail to initialise on iOS 26, cascading
/// into a RealityKit Metal shader crash. Recording the spoken nonce to
/// a side file is a v2 concern that needs an AR-session-aware audio tap.
final class NonceAudioBinder: NSObject {

    private let synthesizer = AVSpeechSynthesizer()

    /// Stays nil for now. ProofBundleBuilder will simply omit the audio
    /// FileRef from the bundle when this is nil.
    var recordingURL: URL? { nil }

    func start(nonce: String, to folder: URL) throws {
        speak(nonce: nonce)
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
    }

    private func speak(nonce: String) {
        let spoken = chunked(nonce)
        let utterance = AVSpeechUtterance(string: spoken)
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.85
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.preUtteranceDelay = 0.3
        utterance.postUtteranceDelay = 1.2
        synthesizer.speak(utterance)
    }

    private func chunked(_ s: String) -> String {
        let trimmed = s.replacingOccurrences(of: "0x", with: "")
        var groups: [String] = []
        var current = ""
        for ch in trimmed {
            current.append(ch)
            if current.count == 4 {
                groups.append(current)
                current = ""
            }
        }
        if !current.isEmpty { groups.append(current) }
        return groups.joined(separator: " — ")
    }
}
