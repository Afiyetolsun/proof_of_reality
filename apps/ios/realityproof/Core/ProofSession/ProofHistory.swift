import Foundation

struct ProofRecord: Identifiable, Hashable {
    let folder: URL
    let bundle: ProofBundle
    let bundleHash: String
    let bundleURL: URL
    let mint: MintRecord?

    var id: URL { folder }

    var mode: ScanMode {
        ScanMode(rawValue: bundle.mode) ?? .roomPlan
    }

    var createdAt: Date {
        Date(timeIntervalSince1970: bundle.createdAt)
    }
}

enum ProofHistory {

    /// Scans Documents/ProofSessions/ for every session folder that
    /// contains a bundle.json, and returns one ProofRecord per folder
    /// sorted newest-first. mint.json is read in if present.
    static func loadAll() -> [ProofRecord] {
        let docs = FileManager.default
            .urls(for: .documentDirectory, in: .userDomainMask).first!
        let root = docs.appendingPathComponent("ProofSessions", isDirectory: true)

        guard let folders = try? FileManager.default.contentsOfDirectory(
            at: root,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else {
            return []
        }

        var records: [ProofRecord] = []
        for folder in folders {
            if let record = load(folder: folder) { records.append(record) }
        }
        return records.sorted { $0.bundle.createdAt > $1.bundle.createdAt }
    }

    static func delete(_ record: ProofRecord) {
        try? FileManager.default.removeItem(at: record.folder)
    }

    private static func load(folder: URL) -> ProofRecord? {
        let bundleURL = folder.appendingPathComponent("bundle.json")
        guard let data = try? Data(contentsOf: bundleURL),
              let bundle = try? JSONDecoder().decode(ProofBundle.self, from: data) else {
            return nil
        }

        let mintURL = folder.appendingPathComponent("mint.json")
        let mint = (try? Data(contentsOf: mintURL))
            .flatMap { try? JSONDecoder().decode(MintRecord.self, from: $0) }

        let bundleHash = (try? ProofHasher.hash(bundle)) ?? "?"

        return ProofRecord(
            folder: folder,
            bundle: bundle,
            bundleHash: bundleHash,
            bundleURL: bundleURL,
            mint: mint
        )
    }
}
