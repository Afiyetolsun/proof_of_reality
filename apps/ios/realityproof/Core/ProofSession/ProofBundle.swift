import CryptoKit
import Foundation
import UIKit

/// The canonical proof bundle written next to the scene file at the end
/// of every capture session. The verifier (web viewer + smart contract)
/// recomputes ProofHasher.hash(bundle) to confirm integrity.
struct ProofBundle: Codable, Hashable {
    let version: Int
    let mode: String
    let createdAt: TimeInterval
    let nonce: String
    let satSig: String
    let nonceExpiresAt: TimeInterval
    let scene: FileRef
    let audio: FileRef?
    let sensorsHash: String
    let device: DeviceInfo

    struct FileRef: Codable, Hashable {
        let name: String
        let sha256: String
        let bytes: Int
    }

    struct DeviceInfo: Codable, Hashable {
        let model: String
        let osVersion: String
        let bundleId: String

        static func current() -> DeviceInfo {
            DeviceInfo(
                model: UIDevice.current.modelIdentifier,
                osVersion: UIDevice.current.systemVersion,
                bundleId: Bundle.main.bundleIdentifier ?? "unknown"
            )
        }
    }
}

extension UIDevice {
    /// Hardware identifier like "iPhone16,2" — more useful for proof
    /// validation than the marketing name.
    fileprivate var modelIdentifier: String {
        var sysinfo = utsname()
        uname(&sysinfo)
        let mirror = Mirror(reflecting: sysinfo.machine)
        return mirror.children.compactMap { _, value -> String? in
            guard let v = value as? Int8, v != 0 else { return nil }
            return String(UnicodeScalar(UInt8(v)))
        }.joined()
    }
}
