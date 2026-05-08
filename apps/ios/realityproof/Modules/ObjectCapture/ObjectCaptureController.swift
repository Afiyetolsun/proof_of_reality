import Combine
import Foundation
import RealityKit
import SwiftUI

@MainActor
final class ObjectCaptureController: ObservableObject {

    enum Phase: Equatable {
        case idle
        case starting
        case ready
        case detecting
        case capturing
        case finishing
        case processing(Double)
        case finished(URL)
        case failed(String)
    }

    @Published var phase: Phase = .idle
    @Published private(set) var captureSession: ObjectCaptureSession?
    @Published var feedbackMessage: String?

    private var imagesDirectory: URL?
    private var outputURL: URL?
    private var observationTasks: [Task<Void, Never>] = []

    func start(in folder: URL) {
        cancelObservation()
        captureSession = nil
        feedbackMessage = nil
        phase = .starting

        do {
            outputURL = folder.appendingPathComponent("scene.usdz")

            let tmp = FileManager.default.temporaryDirectory
                .appendingPathComponent("ObjectCapture_\(UUID().uuidString)", isDirectory: true)
            try FileManager.default.createDirectory(at: tmp, withIntermediateDirectories: true)
            imagesDirectory = tmp

            let session = ObjectCaptureSession()
            var config = ObjectCaptureSession.Configuration()
            config.isOverCaptureEnabled = true
            session.start(imagesDirectory: tmp, configuration: config)

            captureSession = session
            observe(session)
        } catch {
            phase = .failed("Could not start: \(error.localizedDescription)")
        }
    }

    func continueToDetect() {
        guard let session = captureSession, session.startDetecting() else { return }
        phase = .detecting
    }

    func startCapturing() { captureSession?.startCapturing() }

    func finishCapturing() {
        captureSession?.finish()
        phase = .finishing
    }

    func cancel() {
        captureSession?.cancel()
        cancelObservation()
        captureSession = nil
        if let dir = imagesDirectory { try? FileManager.default.removeItem(at: dir) }
        imagesDirectory = nil
        phase = .idle
    }

    /// Resets the controller back to .idle without disposing of the
    /// proof session — used by the "Try Again" button on capture failure.
    /// `cancel()` already cleared the temp dir before .failed fired, so
    /// this just nudges the phase.
    func reset() {
        cancelObservation()
        captureSession = nil
        feedbackMessage = nil
        phase = .idle
    }

    private func observe(_ session: ObjectCaptureSession) {
        let stateTask = Task { @MainActor [weak self] in
            var lastKey: String?
            while !Task.isCancelled {
                let state = session.state
                let key = Self.stateKey(state)
                if key != lastKey {
                    lastKey = key
                    self?.handle(state: state)
                }
                try? await Task.sleep(for: .milliseconds(100))
            }
        }
        let feedbackTask = Task { @MainActor [weak self] in
            var last: String?
            while !Task.isCancelled {
                let msg = session.feedback.compactMap(Self.describe).first
                if msg != last { last = msg; self?.feedbackMessage = msg }
                try? await Task.sleep(for: .milliseconds(150))
            }
        }
        observationTasks = [stateTask, feedbackTask]
    }

    private func cancelObservation() {
        observationTasks.forEach { $0.cancel() }
        observationTasks = []
    }

    private static func stateKey(_ state: ObjectCaptureSession.CaptureState) -> String {
        switch state {
        case .initializing: return "init"
        case .ready:        return "ready"
        case .detecting:    return "detect"
        case .capturing:    return "cap"
        case .finishing:    return "finish"
        case .completed:    return "done"
        case .failed:       return "failed"
        @unknown default:   return "?"
        }
    }

    private func handle(state: ObjectCaptureSession.CaptureState) {
        switch state {
        case .initializing: phase = .starting
        case .ready:        phase = .ready
        case .detecting:    phase = .detecting
        case .capturing:    phase = .capturing
        case .finishing:    phase = .finishing
        case .completed:
            phase = .processing(0)
            runPhotogrammetry()
        case .failed(let err):
            phase = .failed(err.localizedDescription)
        @unknown default:
            break
        }
    }

    private static func describe(_ feedback: ObjectCaptureSession.Feedback) -> String? {
        switch feedback {
        case .objectTooClose:      return "Move farther away"
        case .objectTooFar:        return "Move closer"
        case .movingTooFast:       return "Slow down"
        case .environmentLowLight: return "Add more light"
        case .environmentTooDark:  return "Too dark"
        case .outOfFieldOfView:    return "Centre the object"
        case .overCapturing:       return "Enough coverage"
        default:                   return nil
        }
    }

    private func runPhotogrammetry() {
        guard let imagesDir = imagesDirectory, let outputURL else { return }
        Task { [weak self] in
            do {
                let session = try PhotogrammetrySession(input: imagesDir)
                let request = PhotogrammetrySession.Request.modelFile(url: outputURL, detail: .reduced)
                try session.process(requests: [request])
                for try await output in session.outputs {
                    guard let self else { return }
                    switch output {
                    case .requestProgress(_, let f):
                        self.phase = .processing(f)
                    case .requestComplete:
                        self.phase = .finished(outputURL)
                    case .requestError(_, let err):
                        self.phase = .failed("Photogrammetry: \(err.localizedDescription)")
                    case .processingCancelled:
                        self.phase = .failed("Cancelled")
                    default: break
                    }
                }
            } catch {
                self?.phase = .failed("Photogrammetry start: \(error.localizedDescription)")
            }
            if let dir = self?.imagesDirectory { try? FileManager.default.removeItem(at: dir) }
            self?.imagesDirectory = nil
        }
    }
}
