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
        // We set up our own lighting; SceneKit's default omni would
        // double up with the directionals below and create the harsh
        // grey patches RoomPlan exports show on door / window cutouts.
        view.autoenablesDefaultLighting = false
        view.defaultCameraController.interactionMode = .orbitTurntable
        view.backgroundColor = UIColor(white: 0.05, alpha: 1)
        view.antialiasingMode = .multisampling4X

        guard let scene = try? SCNScene(url: url, options: [
            .convertToYUp: true,
        ]) else {
            return view
        }

        applyMaterialFixups(to: scene)
        addLightingEnvironment(to: scene, background: view.backgroundColor)
        addLights(to: scene)

        let camera = framedCamera(for: scene)
        scene.rootNode.addChildNode(camera)

        view.scene = scene
        view.pointOfView = camera
        return view
    }

    func updateUIView(_ view: SCNView, context: Context) {}

    /// RoomPlan / Object Capture exports often ship with single-sided
    /// materials, baked-in dark transparencies (door cutouts), and a mix
    /// of lighting models. Normalising everything to physically-based +
    /// double-sided makes the IBL we set up below render cleanly.
    private func applyMaterialFixups(to scene: SCNScene) {
        scene.rootNode.enumerateChildNodes { node, _ in
            guard let geometry = node.geometry else { return }
            for material in geometry.materials {
                material.isDoubleSided = true
                material.lightingModel = .physicallyBased
                material.transparencyMode = .default
            }
        }
    }

    /// Image-based environment lighting. Without this, PBR materials look
    /// matte/grey because they have nothing to reflect. A flat white
    /// "sky" gives soft, even illumination — the same trick QuickLook
    /// uses for its USDZ previewer.
    private func addLightingEnvironment(to scene: SCNScene, background: UIColor?) {
        scene.lightingEnvironment.contents = UIColor.white
        scene.lightingEnvironment.intensity = 1.2
        scene.background.contents = background
    }

    /// Three-point lighting: bright ambient floor, soft key from front-
    /// upper-left, gentler fill from the opposite side. No shadow casters
    /// — RoomPlan walls are thin planes and self-shadow ugly.
    private func addLights(to scene: SCNScene) {
        let ambient = SCNNode()
        ambient.light = SCNLight()
        ambient.light?.type = .ambient
        ambient.light?.intensity = 400
        ambient.light?.color = UIColor.white
        scene.rootNode.addChildNode(ambient)

        let key = SCNNode()
        key.light = SCNLight()
        key.light?.type = .directional
        key.light?.intensity = 700
        key.light?.color = UIColor.white
        key.light?.castsShadow = false
        key.eulerAngles = SCNVector3(-Float.pi / 3.5, Float.pi / 6, 0)
        scene.rootNode.addChildNode(key)

        let fill = SCNNode()
        fill.light = SCNLight()
        fill.light?.type = .directional
        fill.light?.intensity = 350
        fill.light?.color = UIColor.white
        fill.light?.castsShadow = false
        fill.eulerAngles = SCNVector3(Float.pi / 4, -Float.pi / 3, 0)
        scene.rootNode.addChildNode(fill)
    }

    /// Builds a camera node positioned along +Z at a distance proportional
    /// to the scene's bounding sphere so the whole model fits in frame on
    /// first render. Without this the default camera sits at the origin
    /// and shows a tiny corner of the scene.
    private func framedCamera(for scene: SCNScene) -> SCNNode {
        let camera = SCNCamera()
        camera.zNear = 0.01
        camera.zFar = 5_000
        camera.wantsHDR = true

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
