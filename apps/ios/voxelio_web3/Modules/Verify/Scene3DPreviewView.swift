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
        view.backgroundColor = UIColor(white: 0.05, alpha: 1)
        view.antialiasingMode = .multisampling4X

        guard let scene = try? SCNScene(url: url, options: [
            .convertToYUp: true,
        ]) else {
            return view
        }

        addLightingIfMissing(to: scene)
        let camera = framedCamera(for: scene)
        scene.rootNode.addChildNode(camera)

        view.scene = scene
        view.pointOfView = camera
        return view
    }

    func updateUIView(_ view: SCNView, context: Context) {}

    /// RoomPlan exports often ship without lights, which makes SceneKit
    /// render them flat black. Drop in an ambient + a directional fill.
    private func addLightingIfMissing(to scene: SCNScene) {
        let hasLight = scene.rootNode.childNodes(passingTest: { node, _ in
            node.light != nil
        }).isEmpty == false
        if hasLight { return }

        let ambient = SCNNode()
        ambient.light = SCNLight()
        ambient.light?.type = .ambient
        ambient.light?.intensity = 500
        scene.rootNode.addChildNode(ambient)

        let directional = SCNNode()
        directional.light = SCNLight()
        directional.light?.type = .directional
        directional.light?.intensity = 800
        directional.eulerAngles = SCNVector3(-Float.pi / 4, Float.pi / 4, 0)
        scene.rootNode.addChildNode(directional)
    }

    /// Builds a camera node positioned along +Z at a distance proportional
    /// to the scene's bounding sphere so the whole model fits in frame on
    /// first render. Without this the default camera sits at the origin
    /// and shows a tiny corner of the scene.
    private func framedCamera(for scene: SCNScene) -> SCNNode {
        let camera = SCNCamera()
        camera.zNear = 0.01
        camera.zFar = 5_000

        let node = SCNNode()
        node.camera = camera

        let (minB, maxB) = scene.rootNode.boundingBox
        let dx = Float(maxB.x - minB.x)
        let dy = Float(maxB.y - minB.y)
        let dz = Float(maxB.z - minB.z)
        let center = SCNVector3(
            Float(minB.x + maxB.x) / 2,
            Float(minB.y + maxB.y) / 2,
            Float(minB.z + maxB.z) / 2
        )
        let radius = max(0.5, sqrtf(dx * dx + dy * dy + dz * dz) / 2)

        node.position = SCNVector3(
            center.x,
            center.y + radius * 0.4,
            center.z + radius * 2.6
        )
        node.look(at: center)
        camera.zFar = Double(radius) * 50
        return node
    }
}
