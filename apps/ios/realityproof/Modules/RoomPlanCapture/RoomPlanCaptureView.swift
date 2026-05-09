import RoomPlan
import SwiftUI

struct RoomPlanCaptureView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var controller = RoomPlanCaptureController()
    @StateObject private var proof = ProofSession()
    @StateObject private var torch = TorchController()
    @State private var didFinalize = false
    @State private var summary: ProofSummaryPayload?

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            // Once `summary` is set ProofSummaryView is on top of us. Hide
            // every overlay so popping the summary doesn't briefly reveal
            // a "Proof bundle built" card (the .onChange handler below
            // dismisses us instantly, but the SwiftUI pop animation would
            // otherwise expose this view's contents for ~150 ms).
            if summary == nil {
                RoomCaptureRepresentable(controller: controller).ignoresSafeArea()

                if controller.phase == .idle && proof.phase != .fetchingNonce {
                    idleOverlay
                }

                if controller.phase == .scanning {
                    VStack(spacing: 12) {
                        HStack(alignment: .top) {
                            TorchButton(torch: torch)
                            Spacer()
                            if let nonce = proof.nonce?.nonce {
                                NonceQR(nonce: nonce, size: 96)
                            }
                        }
                        actionButton("Done Scanning", system: "stop.circle.fill") {
                            controller.finish()
                        }
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                } else {
                    VStack {
                        Spacer()
                        bottomBar
                            .padding(.horizontal, 16)
                            .padding(.bottom, 32)
                    }
                }
            }
        }
        .navigationBarBackButtonHidden(controller.phase == .scanning)
        .task {
            if proof.phase == .idle { await proof.prepare() }
        }
        .onChange(of: controller.phase) { _, phase in
            if phase == .finished, !didFinalize,
               let url = controller.savedSceneURL {
                didFinalize = true
                proof.finalize(mode: .roomPlan, sceneURL: url)
            }
        }
        .onChange(of: proof.phase) { _, phase in
            if case .done(let hash, let url) = phase, summary == nil,
               let bundle = proof.lastBundle {
                summary = ProofSummaryPayload(mode: .roomPlan, bundle: bundle,
                                              hash: hash, bundleURL: url)
            }
        }
        .navigationDestination(item: $summary) { payload in
            ProofSummaryView(payload: payload) { dismiss() }
        }
        // When the summary is popped by ANY means (Done button, back arrow,
        // swipe), also dismiss the capture view so the user lands on the
        // root mode-picker. Without this they get a stale "Proof bundle
        // built" screen they have to manually tap back through.
        .onChange(of: summary) { oldValue, newValue in
            if oldValue != nil && newValue == nil { dismiss() }
        }
        .onDisappear {
            torch.turnOff()
            if controller.phase != .finished { controller.cancel() }
            if case .capturing = proof.phase { proof.cancel() }
        }
    }

    private var idleOverlay: some View {
        VStack(spacing: 12) {
            Image(systemName: "house.fill").font(.system(size: 56)).foregroundStyle(.white.opacity(0.85))
            Text("Ready to scan").font(.title3.bold()).foregroundStyle(.white)
            Text("Walk around the room. RoomPlan tracks walls, doors, windows, and furniture.")
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(.white.opacity(0.75))
                .padding(.horizontal, 32)
        }
    }

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
                actionButton("Start Scan", system: "play.circle.fill") {
                    guard let folder = proof.folder else { return }
                    proof.startBinding()
                    controller.start(in: folder)
                }
            }
        case .scanning:
            EmptyView() // moved to top-anchored controls during native coaching
        case .processing:
            HStack(spacing: 12) {
                ProgressView().tint(.white)
                Text("Processing…").foregroundStyle(.white)
            }
            .padding(.horizontal, 24).padding(.vertical, 14)
            .background(.ultraThinMaterial, in: Capsule())
        case .finished:
            switch proof.phase {
            case .bundling:
                HStack(spacing: 12) {
                    ProgressView().tint(.white)
                    Text("Building proof bundle…").foregroundStyle(.white)
                }
                .padding(.horizontal, 24).padding(.vertical, 14)
                .background(.ultraThinMaterial, in: Capsule())
            case .done(let hash, _):
                doneCard(hash: hash)
            default:
                EmptyView()
            }
        }
    }

    private func actionButton(_ title: String, system: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: system)
                .font(.headline).foregroundStyle(.white)
                .padding(.horizontal, 24).padding(.vertical, 14)
                .background(Capsule().fill(.green.opacity(0.85)))
        }
        .buttonStyle(.plain)
    }

    private func doneCard(hash: String) -> some View {
        VStack(spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: "checkmark.seal.fill").foregroundStyle(.green)
                Text("Proof bundle built").foregroundStyle(.white).font(.headline)
            }
            Text(hash.prefix(16) + "…").font(.caption.monospaced()).foregroundStyle(.white.opacity(0.7))
        }
        .padding(.horizontal, 20).padding(.vertical, 14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18))
    }
}

private struct RoomCaptureRepresentable: UIViewRepresentable {
    let controller: RoomPlanCaptureController

    func makeUIView(context: Context) -> RoomCaptureView {
        let view = RoomCaptureView(frame: .zero)
        controller.attach(view)
        return view
    }

    func updateUIView(_ uiView: RoomCaptureView, context: Context) {}
}
