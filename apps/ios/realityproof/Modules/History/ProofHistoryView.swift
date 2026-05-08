import SwiftUI

struct ProofHistoryView: View {
    @State private var records: [ProofRecord] = []
    @State private var isLoading = true

    var body: some View {
        Group {
            if isLoading && records.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if records.isEmpty {
                emptyState
            } else {
                List {
                    ForEach(records) { record in
                        // NavigationLink(value:) reliably triggers the
                        // .navigationDestination(for:) below — Button +
                        // state-bound .navigationDestination(item:) inside
                        // a List sometimes swallows the first tap, which
                        // is why opening felt flaky / required two taps.
                        NavigationLink(value: record) {
                            row(for: record)
                        }
                    }
                    .onDelete(perform: delete)
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("History")
        .navigationBarTitleDisplayMode(.inline)
        .task { await reload() }
        .navigationDestination(for: ProofRecord.self) { record in
            ProofSummaryView(payload: payload(for: record), onDone: {})
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
            Spacer(minLength: 0)
        }
        .padding(.vertical, 4)
    }

    /// Reload off the main thread. ProofHistory.loadAll iterates folders,
    /// JSON-decodes each bundle, and SHA-256-hashes it — fast per-record
    /// but accumulating delays were enough to make taps feel sluggish.
    private func reload() async {
        isLoading = true
        let loaded = await Task.detached(priority: .userInitiated) {
            ProofHistory.loadAll()
        }.value
        await MainActor.run {
            self.records = loaded
            self.isLoading = false
        }
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
