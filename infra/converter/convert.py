"""
Blender headless: USDZ → GLB.

Invoked as:
    blender --background --python convert.py -- <input.usdz> <output.glb>

Blender exits 0 even when an operator silently does nothing (empty
scene, unsupported USD construct, etc), so we instrument every step
and print to stderr so the wrapper can show real errors back to the
user. Plus we explicitly check that the output file exists at the
end and exit non-zero if it doesn't.
"""

import bpy
import sys
import os

# ---- args (Blender swallows its own; --- separates) ----
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

# Build options: confirm USD + glTF are compiled in. apt blender on
# Ubuntu 24.04 has both by default, but custom builds sometimes drop
# USD which would explain a silent no-op import.
opts = bpy.app.build_options
print(
    f"[convert.py] build_options: usd={getattr(opts, 'usd', '?')} "
    f"io_gltf={getattr(opts, 'io_gltf', '?')}",
    file=sys.stderr,
)

# ---- 1. clean slate ----
bpy.ops.wm.read_factory_settings(use_empty=True)
print(f"[convert.py] cleaned: objects={len(bpy.data.objects)}", file=sys.stderr)

# ---- 2. import the USDZ ----
# Some Blender builds register the operator as `wm.usd_import`, others
# (older or minimal) only have `import_scene.usd_import`. Try both.
import_op = None
for opname in ("wm.usd_import", "import_scene.usd"):
    try:
        op = eval(f"bpy.ops.{opname}")
        if op.poll():
            import_op = (opname, op)
            break
    except (AttributeError, RuntimeError):
        continue

if import_op is None:
    sys.stderr.write("[convert.py] no USD import operator available — Blender lacks USD support\n")
    sys.exit(3)

print(f"[convert.py] using {import_op[0]} for import", file=sys.stderr)
res = import_op[1](filepath=inp)
print(
    f"[convert.py] import result: {res}  "
    f"objects={len(bpy.data.objects)}  meshes={len(bpy.data.meshes)}",
    file=sys.stderr,
)

if len(bpy.data.objects) == 0:
    sys.stderr.write("[convert.py] USD import yielded zero objects — refusing to export empty GLB\n")
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
