import SwiftUI

struct ProofSummaryPayload: Hashable {
    let mode: ScanMode
    let bundle: ProofBundle
    let hash: String
    let bundleURL: URL
    let existingMint: MintRecord?

    init(mode: ScanMode, bundle: ProofBundle, hash: String,
         bundleURL: URL, existingMint: MintRecord? = nil) {
        self.mode = mode
        self.bundle = bundle
        self.hash = hash
        self.bundleURL = bundleURL
        self.existingMint = existingMint
    }
}

struct ProofSummaryView: View {
    @Environment(\.dismiss) private var dismiss
    let payload: ProofSummaryPayload
    let onDone: () -> Void

    @StateObject private var submitter = ProofSubmitter()
    @State private var preview: PreviewMode?
    @State private var labelInput: String = ""

    private enum PreviewMode: Identifiable {
        case threeD, ar
        var id: Int { hashValue }
    }

    /// Result of validating the user-typed ENS label against ENSIP-15-ish
    /// rules the backend enforces. `valid` covers empty (server uses
    /// default vin-...) and well-formed labels alike. `error` is set only
    /// when the user has typed something the server would reject.
    private struct LabelValidation {
        let valid: Bool
        let error: String?
    }

    private var trimmedLabel: String {
        labelInput.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    /// Client-side mirror of the backend rules. Server re-validates and
    /// may also append a `-<bundleHash[2:8]>` suffix on collision, so the
    /// final ensName comes from MintResponse — never re-derived here.
    private var labelValidation: LabelValidation {
        let raw = trimmedLabel
        if raw.isEmpty {
            return LabelValidation(valid: true, error: nil)
        }
        if raw.count < 3 || raw.count > 32 {
            return LabelValidation(valid: false, error: "must be 3–32 chars")
        }
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz0123456789-")
        if raw.unicodeScalars.contains(where: { !allowed.contains($0) }) {
            return LabelValidation(valid: false,
                                   error: "only lowercase letters, digits, hyphens")
        }
        if raw.hasPrefix("-") || raw.hasSuffix("-") {
            return LabelValidation(valid: false,
                                   error: "must start and end with a letter or digit")
        }
        if raw.contains("--") {
            return LabelValidation(valid: false, error: "no consecutive hyphens")
        }
        return LabelValidation(valid: true, error: nil)
    }

    /// What the resolved subname will look like — purely a preview. The
    /// backend may disambiguate on collision (server appends a short
    /// suffix), so this is best-effort, not the source of truth.
    private var labelPreview: String {
        let raw = trimmedLabel
        if !raw.isEmpty {
            return "\(raw).realityproof.eth"
        }
        // Default mirrors the backend fallback: vin-<bundleHash[2:14]>
        let hash = payload.hash
        let prefixIndex = hash.index(hash.startIndex, offsetBy: 2, limitedBy: hash.endIndex) ?? hash.startIndex
        let endIndex = hash.index(prefixIndex, offsetBy: 12, limitedBy: hash.endIndex) ?? hash.endIndex
        let slice = hash[prefixIndex..<endIndex]
        return "vin-\(slice).realityproof.eth"
    }

    var body: some View {
        scrollContent
            .onAppear {
                if let mint = payload.existingMint, submitter.phase == .idle {
                    submitter.seed(mint: mint)
                }
            }
    }

    private var scrollContent: some View {
        ScrollView {
            VStack(spacing: 16) {
                header

                section(title: "Bundle hash") {
                    Text(payload.hash)
                        .font(.footnote.monospaced())
                        .textSelection(.enabled)
                }

                section(title: "Cosmic nonce") {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(payload.bundle.nonce)
                            .font(.footnote.monospaced())
                            .textSelection(.enabled)
                        Text("Satellite signature: \(payload.bundle.satSig.prefix(24))…")
                            .font(.caption2.monospaced())
                            .foregroundStyle(.secondary)
                    }
                }

                section(title: "Artefacts") {
                    artefactRow("Scene", payload.bundle.scene.name, payload.bundle.scene.bytes)
                    if let audio = payload.bundle.audio {
                        artefactRow("Audio", audio.name, audio.bytes)
                    }
                    artefactRow("Sensors hash", payload.bundle.sensorsHash.prefix(16) + "…", nil)

                    HStack(spacing: 10) {
                        Button { preview = .threeD } label: {
                            Label("View 3D", systemImage: "rotate.3d")
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                        }
                        .buttonStyle(.bordered)

                        Button { preview = .ar } label: {
                            Label("View in AR", systemImage: "arkit")
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                        }
                        .buttonStyle(.bordered)
                    }
                    .padding(.top, 4)
                }

                section(title: "Device") {
                    keyValue("Model", payload.bundle.device.model)
                    keyValue("OS", payload.bundle.device.osVersion)
                    keyValue("Bundle", payload.bundle.device.bundleId)
                }

                if case .done(let record) = submitter.phase {
                    mintResultCard(record: record)
                } else if case .failed(let msg) = submitter.phase {
                    failedCard(message: msg)
                }

                // Hide the picker once we have a mint — the ensName on the
                // record is now the source of truth and editing the field
                // would just be misleading.
                if !isMinted {
                    labelPickerSection
                }

                buttonRow
            }
            .padding(20)
        }
        .background(Color(.systemBackground))
        .navigationTitle("Proof bundle")
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(item: $preview) { mode in
            ZStack(alignment: .topTrailing) {
                switch mode {
                case .threeD:
                    Scene3DPreviewView(url: sceneURL).ignoresSafeArea()
                case .ar:
                    USDZPreviewView(url: sceneURL).ignoresSafeArea()
                }
                Button { preview = nil } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title)
                        .foregroundStyle(.white, .black.opacity(0.5))
                        .padding()
                }
            }
        }
    }

    private var sessionFolder: URL {
        payload.bundleURL.deletingLastPathComponent()
    }

    private var sceneURL: URL {
        sessionFolder.appendingPathComponent(payload.bundle.scene.name)
    }

    /// JSON sidecars: bundle.json plus sensors.json and mint.json when
    /// they exist. Lets the user share the cryptographic envelope without
    /// also moving the heavy USDZ.
    private var dataFiles: [URL] {
        var files = [payload.bundleURL]
        for name in ["sensors.json", "mint.json"] {
            let url = sessionFolder.appendingPathComponent(name)
            if FileManager.default.fileExists(atPath: url.path) {
                files.append(url)
            }
        }
        return files
    }

    /// Everything the session produced — JSONs, USDZ scene, optional audio.
    private var allFiles: [URL] {
        var all = dataFiles
        all.append(sceneURL)
        if let audio = payload.bundle.audio {
            let url = sessionFolder.appendingPathComponent(audio.name)
            if FileManager.default.fileExists(atPath: url.path) {
                all.append(url)
            }
        }
        return all
    }

    private var isMinted: Bool {
        if case .done = submitter.phase { return true }
        return false
    }

    /// User-pickable ENS label. Empty input is fine — backend uses the
    /// default vin-... handle. Validation runs live; an invalid label
    /// disables Submit (handled in buttonRow).
    private var labelPickerSection: some View {
        let validation = labelValidation
        return VStack(alignment: .leading, spacing: 8) {
            Text("ENS HANDLE (OPTIONAL)")
                .font(.caption.bold())
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 8) {
                TextField("e.g. my-apartment-prague", text: $labelInput)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled(true)
                    .keyboardType(.asciiCapable)
                    .font(.body.monospaced())
                    .padding(.vertical, 6)
                Divider()
                HStack(spacing: 6) {
                    Image(systemName: "globe")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(labelPreview)
                        .font(.footnote.monospaced())
                        .foregroundStyle(validation.valid ? .secondary : Color.red.opacity(0.8))
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
                if let err = validation.error {
                    Text(err)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
        }
    }

    private var header: some View {
        VStack(spacing: 8) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 56))
                .foregroundStyle(.green)
            Text("Captured \(payload.mode.title.lowercased())")
                .font(.title3.bold())
            Text("Bundle ready to submit")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private func section<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased())
                .font(.caption.bold())
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 8) { content() }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
        }
    }

    private func artefactRow(_ label: String, _ name: any StringProtocol, _ bytes: Int?) -> some View {
        HStack {
            Text(label).foregroundStyle(.secondary)
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(String(name)).font(.footnote.monospaced())
                if let bytes { Text(byteString(bytes)).font(.caption2).foregroundStyle(.secondary) }
            }
        }
    }

    private func keyValue(_ k: String, _ v: String) -> some View {
        HStack {
            Text(k).foregroundStyle(.secondary)
            Spacer()
            Text(v).font(.footnote.monospaced())
        }
    }

    private func mintResultCard(record: MintRecord) -> some View {
        let isStub = record.stub == true
        let title = isStub ? "Mint stubbed" : "Minted on Base Sepolia"
        let tint: Color = isStub ? .orange : .green
        let hasENS = (record.ensName?.isEmpty == false)

        return VStack(alignment: .center, spacing: 14) {
            // 1. Big check icon and headline (ENS-first layout). When the
            // mint is stubbed or ENS publishing failed we drop back to
            // the older Tx-headline layout.
            Image(systemName: isStub ? "exclamationmark.shield.fill" : "checkmark.seal.fill")
                .font(.system(size: 48))
                .foregroundStyle(tint)

            Text(title)
                .font(.headline)

            // 2. Big prominent ENS block — monospaced .title3, with a
            // copy button. This is the new primary identifier.
            if let name = record.ensName, !name.isEmpty {
                prominentENSBlock(name: name, tint: tint)
            }

            // 3. Smaller, dimmed metadata rows beneath the headline.
            VStack(spacing: 4) {
                Text("Token #\(record.tokenId)")
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
                Text("Tx \(record.txHash.prefix(10))…\(record.txHash.suffix(8))")
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
                Text("Minted \(formatMintedAt(record.mintedAt))")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding(.top, 2)

            // 4. Action row — ENS first (primary, prominent), Basescan
            // second (secondary). Share lives in the parent buttonRow
            // and stays untouched.
            if hasENS || record.explorerURL != nil {
                HStack(spacing: 8) {
                    if let ensURL = record.ensURL {
                        Link(destination: ensURL) {
                            Label("ENS", systemImage: "globe")
                                .font(.subheadline.bold())
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.green)
                    }
                    if let explorerURL = record.explorerURL {
                        Link(destination: explorerURL) {
                            Label("Basescan", systemImage: "arrow.up.right.square")
                                .font(.subheadline.bold())
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                        }
                        .buttonStyle(.bordered)
                        .tint(tint)
                    }
                }
                .padding(.top, 4)
            } else if isStub {
                Text("The relay's MINTER_PRIVATE_KEY or REALITY_PROOF_ADDRESS isn't set yet, so no on-chain transaction was created.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(18)
        .background(tint.opacity(0.12),
                    in: RoundedRectangle(cornerRadius: 14))
    }

    /// Big monospaced ENS subname with a copy button. This is the
    /// canonical identifier the user sees first on the success card.
    private func prominentENSBlock(name: String, tint: Color) -> some View {
        VStack(spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(name)
                    .font(.title3.monospaced().bold())
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .truncationMode(.middle)
                    .textSelection(.enabled)
                Button {
                    UIPasteboard.general.string = name
                } label: {
                    Image(systemName: "doc.on.doc")
                        .font(.subheadline)
                }
                .buttonStyle(.borderless)
                .accessibilityLabel("Copy ENS handle")
            }
            Text("ENS handle")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(tint.opacity(0.14),
                    in: RoundedRectangle(cornerRadius: 10))
    }

    private func formatMintedAt(_ ts: TimeInterval) -> String {
        let date = Date(timeIntervalSince1970: ts)
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    private func failedCard(message: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange)
                Text("Submission failed").font(.headline)
            }
            Text(message).font(.footnote).foregroundStyle(.secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.orange.opacity(0.12),
                    in: RoundedRectangle(cornerRadius: 14))
    }

    @ViewBuilder
    private var buttonRow: some View {
        VStack(spacing: 10) {
            switch submitter.phase {
            case .idle, .failed:
                Button {
                    let trimmed = trimmedLabel
                    let labelToSend: String? = trimmed.isEmpty ? nil : trimmed
                    Task {
                        await submitter.submit(payload: payload, label: labelToSend)
                    }
                } label: {
                    Label("Submit Proof", systemImage: "paperplane.fill")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.borderedProminent)
                .disabled(!labelValidation.valid)

            case .uploading:
                statusRow("Uploading bundle…")
            case .minting:
                statusRow("Minting Reality NFT…")
            case .done:
                EmptyView()
            }

            Menu {
                // ENS link goes first when we have one — it's the canonical
                // identifier for this proof, what verifiers actually need.
                if case .done(let record) = submitter.phase, let ensURL = record.ensURL {
                    ShareLink(item: ensURL) {
                        Label("ENS link", systemImage: "globe")
                    }
                }
                ShareLink(item: sceneURL) {
                    Label("3D scene (.usdz)", systemImage: "cube.transparent")
                }
                ShareLink(items: dataFiles) {
                    Label("Proof data (JSON)", systemImage: "doc.text")
                }
                ShareLink(items: allFiles) {
                    Label("Everything", systemImage: "square.and.arrow.up.on.square")
                }
            } label: {
                Label("Share…", systemImage: "square.and.arrow.up")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.bordered)

            Button("Done") { onDone() }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
        }
    }

    private func statusRow(_ text: String) -> some View {
        HStack(spacing: 12) {
            ProgressView()
            Text(text)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
    }

    private func byteString(_ bytes: Int) -> String {
        ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file)
    }
}

