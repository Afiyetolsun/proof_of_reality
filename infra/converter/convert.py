"""
Blender headless script: USDZ → GLB.

Invoked as:
    blender --background --python convert.py -- <input.usdz> <output.glb>

Strategy:
  1. Wipe the default scene
  2. Import the USDZ (Blender 4.x understands USD natively)
  3. Export as GLB with embedded textures + binary buffers (model-viewer
     just wants one .glb file, no external buffer / texture sidecars)

Errors propagate via non-zero exit code; the Node wrapper looks at this
to decide whether to surface a 500 to the viewer.
"""

import bpy
import sys

# Argument parsing — Blender swallows its own args before the `--`
argv = sys.argv
try:
    sep = argv.index("--")
    inp, out = argv[sep + 1], argv[sep + 2]
except (ValueError, IndexError):
    sys.stderr.write("usage: blender -b -P convert.py -- <input.usdz> <output.glb>\n")
    sys.exit(2)

# Clean slate — Blender opens with a default cube, camera, and light;
# importing on top would include them in the GLB.
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import. USDZ is a ZIP container — Blender unpacks transparently.
bpy.ops.wm.usd_import(filepath=inp)

# Export. embed_images + GLB format means the GLB has every texture
# inline; viewer fetches a single file. yup=True flips the up-axis to
# match glTF convention (Y-up) so the model isn't on its side.
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    export_image_format="AUTO",  # JPEG when possible, PNG for alpha
    export_yup=True,
    export_apply=True,           # apply transforms (no nested scale weirdness)
    export_skins=False,          # static scenes; saves a few KB
    export_animations=False,     # likewise
    export_extras=False,
)

print(f"converted {inp} -> {out}", file=sys.stderr)
