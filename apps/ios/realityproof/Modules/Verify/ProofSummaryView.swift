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

    private enum PreviewMode: Identifiable {
        case threeD, ar
        var id: Int { hashValue }
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
        let icon = isStub ? "exclamationmark.shield.fill" : "shield.lefthalf.filled"
        let tint: Color = isStub ? .orange : .green

        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: icon).foregroundStyle(tint)
                Text(title).font(.headline)
            }
            keyValue("Tx", record.txHash.prefix(10) + "…" + record.txHash.suffix(8))
            keyValue("Token", "#\(record.tokenId)")

            // ENS handle — the canonical, shareable identifier for this proof.
            // Renders the name in monospace + a copy button so it reads as a
            // resolvable address rather than a label.
            if let name = record.ensName, !name.isEmpty {
                ensRow(name: name)
            }

            if let url = record.explorerURL {
                HStack(spacing: 8) {
                    Link(destination: url) {
                        Label("Basescan", systemImage: "arrow.up.right.square")
                            .font(.subheadline.bold())
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                    }
                    .buttonStyle(.bordered)
                    .tint(tint)

                    if let ens = record.ensURL {
                        Link(destination: ens) {
                            Label("ENS", systemImage: "globe")
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
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tint.opacity(0.12),
                    in: RoundedRectangle(cornerRadius: 14))
    }

    /// Two-line ENS row: small label then the subname in monospace, plus a
    /// copy button. Tap-and-hold also works via .textSelection(.enabled).
    private func ensRow(name: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("ENS HANDLE")
                .font(.caption2.bold())
                .foregroundStyle(.secondary)
            HStack(alignment: .center, spacing: 8) {
                Text(name)
                    .font(.footnote.monospaced())
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .textSelection(.enabled)
                Button {
                    UIPasteboard.general.string = name
                } label: {
                    Image(systemName: "doc.on.doc")
                        .font(.footnote)
                }
                .buttonStyle(.borderless)
                .accessibilityLabel("Copy ENS handle")
            }
        }
        .padding(.vertical, 2)
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
                    Task { await submitter.submit(payload: payload) }
                } label: {
                    Label("Submit Proof", systemImage: "paperplane.fill")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.borderedProminent)

            case .uploading:
                statusRow("Uploading bundle…")
            case .minting:
                statusRow("Minting Reality NFT…")
            case .done:
                EmptyView()
            }

            Menu {
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

