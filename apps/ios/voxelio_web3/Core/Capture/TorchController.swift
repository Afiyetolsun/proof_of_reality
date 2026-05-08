import AVFoundation
import Combine
import SwiftUI

/// Tiny wrapper around the rear camera's torch. Both RoomCaptureView
/// (ARKit) and ObjectCaptureSession (RealityKit) own the AVCaptureSession
/// internally — we don't add the device, we just lock it for config and
/// flip torchMode while their session keeps it alive.
@MainActor
final class TorchController: ObservableObject {
    @Published private(set) var isOn = false

    var isAvailable: Bool {
        device?.hasTorch == true
    }

    private var device: AVCaptureDevice? {
        AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back)
    }

    func toggle() {
        guard let device, device.hasTorch, device.isTorchAvailable else { return }
        do {
            try device.lockForConfiguration()
            defer { device.unlockForConfiguration() }
            if device.torchMode == .on {
                device.torchMode = .off
                isOn = false
            } else {
                try device.setTorchModeOn(level: 1.0)
                isOn = true
            }
        } catch {
            // Torch toggle is non-essential — silently noop on failure.
        }
    }

    /// Always turn off when the capture view goes away.
    func turnOff() {
        guard let device, device.hasTorch, device.torchMode == .on else { return }
        try? device.lockForConfiguration()
        device.torchMode = .off
        device.unlockForConfiguration()
        isOn = false
    }
}

struct TorchButton: View {
    @ObservedObject var torch: TorchController

    var body: some View {
        if torch.isAvailable {
            Button { torch.toggle() } label: {
                Image(systemName: torch.isOn ? "flashlight.on.fill" : "flashlight.off.fill")
                    .font(.title3)
                    .foregroundStyle(torch.isOn ? .yellow : .white)
                    .frame(width: 44, height: 44)
                    .background(.ultraThinMaterial, in: Circle())
                    .overlay(Circle().stroke(.white.opacity(0.2), lineWidth: 0.5))
            }
            .accessibilityLabel(torch.isOn ? "Turn flashlight off" : "Turn flashlight on")
        }
    }
}
