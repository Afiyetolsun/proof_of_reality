import SwiftUI

struct ProofHistoryView: View {
    @State private var records: [ProofRecord] = []
    @State private var selection: ProofRecord?

    var body: some View {
        Group {
            if records.isEmpty {
                emptyState
            } else {
                List {
                    ForEach(records) { record in
                        Button { selection = record } label: {
                            row(for: record)
                        }
                        .buttonStyle(.plain)
                    }
                    .onDelete(perform: delete)
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("History")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear(perform: reload)
        .navigationDestination(item: $selection) { record in
            ProofSummaryView(payload: payload(for: record), onDone: {
                selection = nil
            })
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "tray").font(.system(size: 56)).foregroundStyle(.secondary)
            Text("No proofs yet").font(.title3.bold())
            Text("Scan a room or object to record your first proof.")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func row(for record: ProofRecord) -> some View {
        HStack(spacing: 14) {
            Image(systemName: record.mode.systemImage)
                .font(.title3)
                .frame(width: 40, height: 40)
                .background(.tint.opacity(0.15), in: RoundedRectangle(cornerRadius: 10))
                .foregroundStyle(.tint)

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(record.mode.title).font(.headline)
                    if record.mint != nil {
                        Image(systemName: "checkmark.seal.fill")
                            .foregroundStyle(.green)
                            .font(.caption)
                    }
                }
                Text(timestampString(record.createdAt))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(record.bundleHash.prefix(16) + "…")
                    .font(.caption2.monospaced())
                    .foregroundStyle(.tertiary)
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(.tertiary)
        }
        .padding(.vertical, 4)
    }

    private func reload() {
        records = ProofHistory.loadAll()
    }

    private func delete(at offsets: IndexSet) {
        for index in offsets {
            ProofHistory.delete(records[index])
        }
        records.remove(atOffsets: offsets)
    }

    private func payload(for record: ProofRecord) -> ProofSummaryPayload {
        // Forward the persisted mint so reopening a previously-minted scan
        // shows the success card instead of a Submit button (which would
        // re-mint the same bundleHash and revert with DuplicateBundle).
        ProofSummaryPayload(
            mode: record.mode,
            bundle: record.bundle,
            hash: record.bundleHash,
            bundleURL: record.bundleURL,
            existingMint: record.mint
        )
    }

    private func timestampString(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

#Preview {
    NavigationStack { ProofHistoryView() }
}
