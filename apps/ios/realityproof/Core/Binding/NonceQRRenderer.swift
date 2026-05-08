import CoreImage.CIFilterBuiltins
import SwiftUI
import UIKit

/// Renders a cosmic nonce as a QR code suitable for keeping in-frame
/// during a scan. The QR is the primary "visual binding" — postfactum
/// generation of a scene with the same nonce is impossible because the
/// nonce only existed after a specific moment in time.
struct NonceQR: View {
    let nonce: String
    var size: CGFloat = 120

    private static let context = CIContext()
    private static let filter = CIFilter.qrCodeGenerator()

    var body: some View {
        VStack(spacing: 6) {
            Image(uiImage: Self.qrImage(for: nonce, size: size) ?? UIImage())
                .interpolation(.none)
                .resizable()
                .frame(width: size, height: size)
                .padding(8)
                .background(.white)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12)
                    .stroke(.white.opacity(0.2), lineWidth: 1))

            Text(shortNonce)
                .font(.caption2.monospaced())
                .foregroundStyle(.white)
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(.black.opacity(0.6), in: Capsule())
        }
        .accessibilityLabel("Cosmic nonce \(shortNonce)")
    }

    private var shortNonce: String {
        let trimmed = nonce.replacingOccurrences(of: "0x", with: "")
        guard trimmed.count > 12 else { return trimmed }
        let prefix = trimmed.prefix(6)
        let suffix = trimmed.suffix(4)
        return "\(prefix)…\(suffix)"
    }

    static func qrImage(for string: String, size: CGFloat) -> UIImage? {
        filter.message = Data(string.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage else { return nil }

        let scale = size / output.extent.width
        let scaled = output.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        guard let cg = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}

#Preview {
    ZStack {
        Color.black.ignoresSafeArea()
        NonceQR(nonce: "0a4c2ea21557418bbc1d57120142ad83e8fa6e030ad35125fe225b97929d2526")
    }
}
