import SwiftUI

struct RootView: View {
    @State private var selectedMode: ScanMode?
    @State private var showHistory = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                header

                VStack(spacing: 16) {
                    ForEach(ScanMode.allCases) { mode in
                        Button { selectedMode = mode } label: {
                            ModeCard(mode: mode)
                        }
                        .buttonStyle(.plain)
                    }
                }

                Spacer()

                footer
            }
            .padding(24)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showHistory = true
                    } label: {
                        Image(systemName: "clock.arrow.circlepath")
                    }
                    .accessibilityLabel("Proof history")
                }
            }
            .navigationDestination(item: $selectedMode) { mode in
                switch mode {
                case .roomPlan:
                    RoomPlanCaptureView()
                case .objectCapture:
                    ObjectCaptureScanView()
                }
            }
            .navigationDestination(isPresented: $showHistory) {
                ProofHistoryView()
            }
        }
    }

    private var header: some View {
        VStack(spacing: 8) {
            Text("Proof of Reality")
                .font(.largeTitle.bold())
            Text("Pick a capture mode")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var footer: some View {
        Text("ETHPrague 2026 · SpaceComputer track")
            .font(.caption)
            .foregroundStyle(.tertiary)
    }
}

private struct ModeCard: View {
    let mode: ScanMode

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: mode.systemImage)
                .font(.system(size: 28, weight: .semibold))
                .frame(width: 56, height: 56)
                .background(.tint.opacity(0.15), in: RoundedRectangle(cornerRadius: 14))
                .foregroundStyle(.tint)

            VStack(alignment: .leading, spacing: 4) {
                Text(mode.title).font(.headline)
                Text(mode.subtitle).font(.subheadline).foregroundStyle(.secondary)
            }

            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(.tertiary)
        }
        .padding(16)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18))
    }
}

#Preview { RootView() }
