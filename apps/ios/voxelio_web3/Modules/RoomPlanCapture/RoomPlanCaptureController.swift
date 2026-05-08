import Combine
import Foundation
import RoomPlan

@MainActor
final class RoomPlanCaptureController: NSObject, ObservableObject,
                                       RoomCaptureViewDelegate, RoomCaptureSessionDelegate {

    enum Phase: Equatable {
        case idle
        case scanning
        case processing
        case finished
    }

    @Published var phase: Phase = .idle
    @Published var capturedRoom: CapturedRoom?
    @Published var savedSceneURL: URL?
    @Published var processingError: String?

    weak var captureView: RoomCaptureView?
    private var outputFolder: URL?

    override init() { super.init() }
    required init?(coder: NSCoder) { super.init() }
    func encode(with coder: NSCoder) {}

    func attach(_ view: RoomCaptureView) {
        view.delegate = self
        view.captureSession.delegate = self
        captureView = view
    }

    func start(in folder: URL) {
        guard let view = captureView else { return }
        outputFolder = folder
        capturedRoom = nil
        savedSceneURL = nil
        processingError = nil

        var configuration = RoomCaptureSession.Configuration()
        configuration.isCoachingEnabled = true
        view.captureSession.run(configuration: configuration)
        phase = .scanning
    }

    func finish() {
        guard let view = captureView else { return }
        view.captureSession.stop()
        phase = .processing
    }

    func cancel() {
        captureView?.captureSession.stop(pauseARSession: true)
        phase = .idle
    }

    nonisolated func captureView(shouldPresent roomDataForProcessing: CapturedRoomData,
                                 error: Error?) -> Bool {
        return error == nil
    }

    nonisolated func captureView(didPresent processedResult: CapturedRoom, error: Error?) {
        Task { @MainActor in
            self.capturedRoom = processedResult
            if let error { self.processingError = error.localizedDescription }
            self.phase = .finished
            self.persistScene()
        }
    }

    private func persistScene() {
        guard let room = capturedRoom, let folder = outputFolder else { return }
        do {
            let url = folder.appendingPathComponent("scene.usdz")
            try room.export(to: url, exportOptions: [.parametric, .mesh])
            savedSceneURL = url
        } catch {
            processingError = "Could not save scene: \(error.localizedDescription)"
        }
    }
}

enum ProofStorage {
    static func sessionFolder() throws -> URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let folder = docs
            .appendingPathComponent("ProofSessions", isDirectory: true)
            .appendingPathComponent(ISO8601DateFormatter().string(from: Date()), isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }
}
