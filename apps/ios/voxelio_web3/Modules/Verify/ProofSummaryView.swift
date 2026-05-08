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
    @State private var showShare = false
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
        .sheet(isPresented: $showShare) {
            ShareSheet(items: [payload.bundleURL])
        }
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

    private var sceneURL: URL {
        payload.bundleURL
            .deletingLastPathComponent()
            .appendingPathComponent(payload.bundle.scene.name)
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

        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon).foregroundStyle(tint)
                Text(title).font(.headline)
            }
            keyValue("Tx", record.txHash.prefix(10) + "…" + record.txHash.suffix(8))
            keyValue("Token", "#\(record.tokenId)")
            if let ens = record.ensName { keyValue("ENS", ens) }

            if let url = record.explorerURL {
                Link(destination: url) {
                    Label("View on Basescan", systemImage: "arrow.up.right.square")
                        .font(.subheadline.bold())
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                }
                .buttonStyle(.bordered)
                .tint(tint)
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

            Button {
                showShare = true
            } label: {
                Label("Share bundle.json", systemImage: "square.and.arrow.up")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
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

private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
