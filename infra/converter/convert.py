"""
Blender headless: USDZ → GLB.

Invoked as:
    blender --background --python convert.py -- <input.usdz> <output.glb>

Blender exits 0 even when an operator silently does nothing (empty
scene, unsupported USD construct, etc), so we instrument every step
and print to stderr so the wrapper can show real errors back to the
user. Plus we explicitly check that the output file exists at the
end and exit non-zero if it doesn't.

This script assumes the host Blender has USD support compiled in. The
Dockerfile asserts that at build time (`bpy.app.build_options.usd`),
so if you're seeing "no USD operator" failures here, it means someone
swapped the Blender binary for a USD-less one — fix that, don't patch
this script.
"""

import bpy
import sys
import os

# ---- args (Blender swallows its own; -- separates) ----
argv = sys.argv
try:
    sep = argv.index("--")
    inp, out = argv[sep + 1], argv[sep + 2]
except (ValueError, IndexError):
    sys.stderr.write("usage: blender -b -P convert.py -- <input.usdz> <output.glb>\n")
    sys.exit(2)

print(f"[convert.py] blender {bpy.app.version_string}", file=sys.stderr)
print(f"[convert.py] input  {inp}  exists={os.path.exists(inp)}", file=sys.stderr)
print(f"[convert.py] output {out}", file=sys.stderr)

opts = bpy.app.build_options
print(
    f"[convert.py] build_options: usd={getattr(opts, 'usd', '?')} "
    f"io_gltf={getattr(opts, 'io_gltf', '?')}",
    file=sys.stderr,
)
if not getattr(opts, "usd", False):
    # Refuse early instead of producing an empty GLB. The Dockerfile is
    # supposed to have caught this at build time.
    sys.stderr.write(
        "[convert.py] FATAL: this Blender lacks USD support. "
        "Rebuild the converter image from the official blender.org tarball.\n"
    )
    sys.exit(3)

# ---- 1. clean slate ----
bpy.ops.wm.read_factory_settings(use_empty=True)
print(f"[convert.py] cleaned: objects={len(bpy.data.objects)}", file=sys.stderr)

# ---- 2. import the USDZ ----
# Official Blender 4.x exposes the import operator as `wm.usd_import`.
# The legacy `import_scene.usd` alias was removed somewhere around 3.5.
res = bpy.ops.wm.usd_import(filepath=inp)
print(
    f"[convert.py] import result: {res}  "
    f"objects={len(bpy.data.objects)}  meshes={len(bpy.data.meshes)}",
    file=sys.stderr,
)

if len(bpy.data.objects) == 0:
    sys.stderr.write(
        "[convert.py] USD import yielded zero objects — refusing to export empty GLB. "
        "Likely an unsupported USD feature in this asset; check stderr above for "
        "Blender's USD reader warnings.\n"
    )
    sys.exit(4)

# ---- 3. export GLB (minimal args; some 4.x params don't exist in 4.0) ----
res = bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
)
print(f"[convert.py] export result: {res}", file=sys.stderr)

if not os.path.exists(out):
    sys.stderr.write(f"[convert.py] export operator returned but {out} doesn't exist\n")
    sys.exit(5)

size = os.path.getsize(out)
print(f"[convert.py] wrote {size} bytes to {out}", file=sys.stderr)
