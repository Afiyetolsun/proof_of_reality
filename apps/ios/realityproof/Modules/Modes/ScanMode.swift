import Foundation

enum ScanMode: String, CaseIterable, Identifiable {
    case roomPlan
    case objectCapture

    var id: String { rawValue }

    var title: String {
        switch self {
        case .roomPlan: return "Room"
        case .objectCapture: return "Object"
        }
    }

    var subtitle: String {
        switch self {
        case .roomPlan: return "Real estate, interiors"
        case .objectCapture: return "Cars, watches, RWA"
        }
    }

    var systemImage: String {
        switch self {
        case .roomPlan: return "house.fill"
        case .objectCapture: return "cube.fill"
        }
    }

    /// Numeric mode the smart contract expects.
    /// 0 = roomPlan, 1 = objectCapture, 2 = stereoFusion (reserved).
    var contractValue: Int {
        switch self {
        case .roomPlan: return 0
        case .objectCapture: return 1
        }
    }
}
