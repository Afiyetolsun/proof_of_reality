import RealityKit
import SwiftUI

struct ObjectCaptureScanView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var controller = ObjectCaptureController()
    @StateObject private var proof = ProofSession()
    @StateObject private var torch = TorchController()
    @State private var didFinalize = false
    @State private var summary: ProofSummaryPayload?

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if let session = controller.captureSession, !isPostCapture {
                ObjectCaptureView(session: session).ignoresSafeArea()
            } else if controller.phase == .idle {
                idleOverlay
            } else if isProcessing {
                processingOverlay
            } else if isFinished {
                finishedOverlay
            }

            if isNativeCoachingActive {
                topAnchoredControls
            } else {
                VStack {
                    Spacer()
                    bottomBar
                        .padding(.horizontal, 16)
                        .padding(.bottom, 32)
                }
            }
        }
        .task {
            if proof.phase == .idle { await proof.prepare() }
        }
        .onChange(of: controller.phase) { _, newPhase in
            if case .finished(let url) = newPhase, !didFinalize {
                didFinalize = true
                proof.finalize(mode: .objectCapture, sceneURL: url)
            }
        }
        .onChange(of: proof.phase) { _, p in
            if case .done(let hash, let url) = p, summary == nil,
               let bundle = proof.lastBundle {
                summary = ProofSummaryPayload(mode: .objectCapture, bundle: bundle,
                                              hash: hash, bundleURL: url)
            }
        }
        .navigationDestination(item: $summary) { payload in
            ProofSummaryView(payload: payload) { dismiss() }
        }
        .onDisappear {
            torch.turnOff()
            if !isPostCapture && controller.phase != .idle { controller.cancel() }
            if case .capturing = proof.phase { proof.cancel() }
        }
        .alert("Reconstruction couldn't complete", isPresented: failedBinding) {
            Button("Try Again") {
                didFinalize = false
                controller.reset()
            }
            Button("Cancel", role: .cancel) {
                controller.cancel()
                dismiss()
            }
        } message: {
            Text(friendlyFailureMessage)
        }
    }

    /// Translates the raw Apple error to something a hackathon judge or
    /// first-time user can act on. Keep it short.
    private var friendlyFailureMessage: String {
        let raw = failureMessage.lowercased()
        if raw.contains("photogrammetry") || raw.contains("processerror") {
            return "Object Capture's 3D solver couldn't piece the frames together. Try again with:\n\n• A textured surface under the object\n• Even, bright lighting (no harsh shadows)\n• Slow, steady orbit covering all sides\n• Avoid shiny, transparent or solid-colour objects"
        }
        return failureMessage.isEmpty ? "Capture failed." : failureMessage
    }

    // MARK: - Top-anchored controls (active during Apple's native coaching)

    private var topAnchoredControls: some View {
        VStack(spacing: 12) {
            HStack(alignment: .top) {
                TorchButton(torch: torch)
                Spacer()
                if let nonce = proof.nonce?.nonce {
                    NonceQR(nonce: nonce, size: 96)
                }
            }
            topActionCard
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
    }

    @ViewBuilder
    private var topActionCard: some View {
        VStack(spacing: 8) {
            feedbackBadge
            switch controller.phase {
            case .ready:
                actionButton("Continue", system: "arrow.right.circle.fill") {
                    controller.continueToDetect()
                }
            case .detecting:
                actionButton("Begin Capture", system: "camera.aperture") {
                    controller.startCapturing()
                }
            case .capturing:
                actionButton("Finish", system: "checkmark.circle.fill") {
                    controller.finishCapturing()
                }
            case .finishing:
                HStack(spacing: 12) {
                    ProgressView().tint(.white)
                    Text("Finishing…").foregroundStyle(.white)
                }
                .padding(.horizontal, 18).padding(.vertical, 10)
                .background(.ultraThinMaterial, in: Capsule())
            default:
                EmptyView()
            }
        }
    }

    // MARK: - Bottom bar (no native coaching active)

    @ViewBuilder
    private var bottomBar: some View {
        switch controller.phase {
        case .idle:
            switch proof.phase {
            case .fetchingNonce:
                HStack(spacing: 12) {
                    ProgressView().tint(.white)
                    Text("Fetching cosmic nonce…").foregroundStyle(.white)
                }
                .padding(.horizontal, 24).padding(.vertical, 14)
                .background(.ultraThinMaterial, in: Capsule())
            default:
                actionButton("Start", system: "play.circle.fill") {
                    guard let folder = proof.folder else { return }
                    proof.startBinding()
                    controller.start(in: folder)
                }
            }
        case .starting:
            ProgressView().tint(.white)
        default:
            EmptyView()
        }
    }

    // MARK: - Static overlays

    private var idleOverlay: some View {
        VStack(spacing: 12) {
            Image(systemName: "shippingbox.fill").font(.system(size: 56)).foregroundStyle(.white.opacity(0.85))
            Text("Object Capture").font(.title3.bold()).foregroundStyle(.white)
            Text("Place the object on a contrasting surface with even lighting.")
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(.white.opacity(0.75))
                .padding(.horizontal, 32)
        }
    }

    private var processingOverlay: some View {
        VStack(spacing: 14) {
            ProgressView().tint(.white).controlSize(.large)
            Text("Reconstructing model").font(.title3.bold()).foregroundStyle(.white)
            ProgressView(value: processingFraction).tint(.teal).frame(maxWidth: 240)
            Text("\(Int(processingFraction * 100))%").font(.headline.monospacedDigit()).foregroundStyle(.white)
        }
    }

    private var finishedOverlay: some View {
        VStack(spacing: 12) {
            Image(systemName: "checkmark.seal.fill").font(.system(size: 56)).foregroundStyle(.green)
            if case .done(let hash, _) = proof.phase {
                Text("Proof bundle built").font(.title3.bold()).foregroundStyle(.white)
                Text(hash.prefix(16) + "…").font(.caption.monospaced()).foregroundStyle(.white.opacity(0.7))
            } else if case .bundling = proof.phase {
                Text("Building proof bundle…").font(.title3.bold()).foregroundStyle(.white)
            } else {
                Text("Captured").font(.title3.bold()).foregroundStyle(.white)
            }
        }
    }

    // MARK: - Building blocks

    @ViewBuilder
    private var feedbackBadge: some View {
        if let msg = controller.feedbackMessage {
            HStack(spacing: 6) {
                Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.yellow)
                Text(msg).foregroundStyle(.white)
            }
            .font(.caption.bold())
            .padding(.horizontal, 12).padding(.vertical, 6)
            .background(.black.opacity(0.45), in: Capsule())
        }
    }

    private func actionButton(_ title: String, system: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: system)
                .font(.headline).foregroundStyle(.white)
                .padding(.horizontal, 24).padding(.vertical, 14)
                .background(Capsule().fill(.teal.opacity(0.85)))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Phase helpers

    private var isPostCapture: Bool {
        switch controller.phase {
        case .processing, .finished, .failed: return true
        default: return false
        }
    }
    private var isNativeCoachingActive: Bool {
        switch controller.phase {
        case .ready, .detecting, .capturing, .finishing: return true
        default: return false
        }
    }
    private var isProcessing: Bool { if case .processing = controller.phase { return true } else { return false } }
    private var isFinished: Bool { if case .finished = controller.phase { return true } else { return false } }
    private var processingFraction: Double {
        if case .processing(let f) = controller.phase { return f } else { return 0 }
    }
    private var failureMessage: String {
        if case .failed(let msg) = controller.phase { return msg } else { return "" }
    }
    private var failedBinding: Binding<Bool> {
        Binding(
            get: { if case .failed = controller.phase { return true } else { return false } },
            set: { _ in }
        )
    }
}
