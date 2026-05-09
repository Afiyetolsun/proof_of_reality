"""Standalone Poisson reconstruction worker.

Runs in a separate process so a C++ crash in Open3D's Poisson code (the
`Failed to close loop` path in PoissonRecon's isosurface extractor, and
the OOM-killer that follows on resource-limited devices like the OAK4)
can't take down the FastAPI server that spawned us.

Invoked by main.py:
    python3 poisson_worker.py <input_pcd.ply> <output_mesh.ply>

Exits 0 on success and writes the reconstructed mesh to <output_mesh.ply>.
Last line of stdout is a single JSON object with stats / failure reason.
"""

from __future__ import annotations

import json
import sys
import traceback

import numpy as np
import open3d as o3d


def reconstruct(input_path: str, output_path: str,
                depth: int = 8, voxel_target: int = 50_000,
                density_quantile: float = 0.05) -> dict:
    pcd = o3d.io.read_point_cloud(input_path)
    n_in = len(pcd.points)
    if n_in < 500:
        return {"ok": False, "reason": "too_few_points", "n_in": n_in}

    # Voxel-downsample to keep Poisson's octree tractable. Smaller input
    # → smaller octree → less RAM → less risk of triggering the C++
    # "Failed to close loop" path or being OOM-killed by the kernel.
    if n_in > voxel_target:
        bb = pcd.get_axis_aligned_bounding_box()
        diag = float(np.linalg.norm(bb.get_extent()))
        # Heuristic that lands a 100k room scan around 30-50k.
        vox = max(0.005, diag / (voxel_target ** (1 / 3)) * 0.3)
        pcd = pcd.voxel_down_sample(vox)

    n_after = len(pcd.points)
    if n_after < 500:
        return {"ok": False, "reason": "too_few_after_downsample",
                "n_in": n_in, "n_after": n_after}

    # Estimate normals; orient them toward the OAK camera (origin in
    # TSDF world frame --- self.pose starts as identity, so frame 0's
    # camera centre is (0,0,0)). This is dramatically cheaper and more
    # robust than orient_normals_consistent_tangent_plane, which builds
    # a global MST that's the leading cause of Poisson crashes on
    # noisy clouds.
    pcd.estimate_normals(
        search_param=o3d.geometry.KDTreeSearchParamHybrid(
            radius=0.05, max_nn=30))
    pcd.orient_normals_towards_camera_location(np.array([0.0, 0.0, 0.0]))

    mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
        pcd, depth=depth, n_threads=-1)
    if mesh is None or len(mesh.triangles) == 0:
        return {"ok": False, "reason": "poisson_empty",
                "n_in": n_in, "n_after": n_after}

    # Crop low-density vertices: standard fix for Poisson's "ballooning"
    # extrapolation on the unseen back side of single-view scans.
    densities = np.asarray(densities)
    if len(densities) > 0:
        cutoff = float(np.quantile(densities, density_quantile))
        drop = densities < cutoff
        if drop.any():
            mesh.remove_vertices_by_mask(drop)

    if len(mesh.triangles) == 0:
        return {"ok": False, "reason": "poisson_cropped_empty",
                "n_in": n_in, "n_after": n_after}

    mesh.compute_vertex_normals()
    o3d.io.write_triangle_mesh(output_path, mesh, write_ascii=False)
    return {"ok": True, "n_in": n_in, "n_after": n_after,
            "vertex_count": int(len(mesh.vertices)),
            "triangle_count": int(len(mesh.triangles))}


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("usage: poisson_worker.py <input.ply> <output.ply>",
              file=sys.stderr)
        sys.exit(64)
    try:
        result = reconstruct(sys.argv[1], sys.argv[2])
        print(json.dumps(result))
        sys.exit(0 if result.get("ok") else 1)
    except Exception as e:
        print(json.dumps({
            "ok": False, "reason": "exception",
            "type": type(e).__name__, "msg": str(e),
            "traceback": traceback.format_exc(),
        }))
        sys.exit(2)
