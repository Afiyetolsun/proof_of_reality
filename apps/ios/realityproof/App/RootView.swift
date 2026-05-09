import SwiftUI

/// Home tab content. The history surface used to live behind a toolbar
/// button here; it's now a peer tab in MainTabView so the user can move
/// between Home and Scans without a back-stack.
struct RootView: View {
    @State private var selectedMode: ScanMode?

    var body: some View {
        VStack(alignment: .leading, spacing: 28) {
            header

            modeList

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 24)
        .padding(.top, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .navigationDestination(item: $selectedMode) { mode in
            switch mode {
            case .roomPlan:
                RoomPlanCaptureView()
            case .objectCapture:
                ObjectCaptureScanView()
            }
        }
    }

    /// Tight title block — subtitle hugs the title instead of floating in the
    /// middle of the screen between the header and the mode cards.
    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Proof of Reality")
                .font(.largeTitle.bold())
            Text("Pick a capture mode")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var modeList: some View {
        VStack(spacing: 14) {
            ForEach(ScanMode.allCases) { mode in
                Button { selectedMode = mode } label: {
                    ModeCard(mode: mode)
                }
                .buttonStyle(.plain)
            }
        }
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
