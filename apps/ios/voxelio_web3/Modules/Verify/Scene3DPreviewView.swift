import SceneKit
import SwiftUI

/// Pure 3D viewer for a USDZ — orbit / pan / zoom via SceneKit's built-in
/// camera controls, no AR. Used when the user wants to inspect the
/// captured model without leaving the app or worrying about a flat
/// surface for AR placement.
struct Scene3DPreviewView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> SCNView {
        let view = SCNView(frame: .zero)
        view.allowsCameraControl = true
        view.autoenablesDefaultLighting = true
        view.defaultCameraController.interactionMode = .orbitTurntable
        view.backgroundColor = .black
        view.antialiasingMode = .multisampling4X

        if let scene = try? SCNScene(url: url, options: [
            .checkConsistency: true,
            .convertToYUp: true,
        ]) {
            // Drop in a light if the USDZ doesn't carry one — common with
            // RoomPlan exports.
            if scene.rootNode.childNodes(passingTest: { node, _ in
                node.light != nil
            }).isEmpty {
                let ambient = SCNLight()
                ambient.type = .ambient
                ambient.intensity = 600
                let ambientNode = SCNNode()
                ambientNode.light = ambient
                scene.rootNode.addChildNode(ambientNode)
            }
            view.scene = scene
        }

        return view
    }

    func updateUIView(_ view: SCNView, context: Context) {}
}
