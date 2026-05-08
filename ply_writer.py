import numpy as np


def merge_frames(points_list, colors_list, voxel_size=0.02,
                 z_min=0.1, z_max=5.0):
    """Concatenate per-frame point clouds, drop noise, optionally voxel-downsample.

    Auto-detects depth units: depthai emits either meters or millimetres
    depending on node config; if the median |z| looks big we treat it as mm
    and convert to metres before clipping.
    """
    pts = np.concatenate(points_list, axis=0).astype(np.float32, copy=False)
    if colors_list and any(c is not None for c in colors_list):
        cols = np.concatenate(
            [c if c is not None else np.zeros((p.shape[0], 3), np.uint8)
             for p, c in zip(points_list, colors_list)],
            axis=0,
        ).astype(np.uint8, copy=False)
    else:
        cols = None

    finite = np.isfinite(pts).all(axis=1) & (np.linalg.norm(pts, axis=1) > 1e-6)
    pts = pts[finite]
    if cols is not None:
        cols = cols[finite]

    if pts.shape[0] > 0:
        med = np.median(np.abs(pts[:, 2]))
        if med > 10.0:
            pts = pts / 1000.0

    z = pts[:, 2]
    keep = (z > z_min) & (z < z_max)
    pts = pts[keep]
    if cols is not None:
        cols = cols[keep]

    if voxel_size > 0 and pts.shape[0] > 0:
        pts, cols = _voxel_downsample(pts, cols, voxel_size)
    return pts, cols


def _voxel_downsample(pts, cols, voxel_size):
    """Pick one representative point per voxel via lexsort. O(N log N)."""
    grid = np.floor(pts / voxel_size).astype(np.int32)
    # Pack (i,j,k) into int64; assumes |i|,|j|,|k| < 2^20 (~10 km at 1cm voxels)
    key = (grid[:, 0].astype(np.int64) << 42) | \
          ((grid[:, 1].astype(np.int64) & 0x1FFFFF) << 21) | \
          (grid[:, 2].astype(np.int64) & 0x1FFFFF)
    order = np.argsort(key, kind="stable")
    sorted_key = key[order]
    first = np.concatenate(([True], sorted_key[1:] != sorted_key[:-1]))
    pick = order[first]
    return pts[pick], (cols[pick] if cols is not None else None)


def write_binary_ply(path, points, colors):
    """Write little-endian binary PLY with optional uchar RGB."""
    n = points.shape[0]
    has_color = colors is not None and colors.shape[0] == n
    header = [
        "ply",
        "format binary_little_endian 1.0",
        f"element vertex {n}",
        "property float x",
        "property float y",
        "property float z",
    ]
    if has_color:
        header += [
            "property uchar red",
            "property uchar green",
            "property uchar blue",
        ]
    header.append("end_header\n")
    header_bytes = ("\n".join(header)).encode("ascii")

    if has_color:
        dt = np.dtype([
            ("x", "<f4"), ("y", "<f4"), ("z", "<f4"),
            ("r", "u1"), ("g", "u1"), ("b", "u1"),
        ])
        rec = np.empty(n, dtype=dt)
        rec["x"] = points[:, 0]
        rec["y"] = points[:, 1]
        rec["z"] = points[:, 2]
        rec["r"] = colors[:, 0]
        rec["g"] = colors[:, 1]
        rec["b"] = colors[:, 2]
    else:
        dt = np.dtype([("x", "<f4"), ("y", "<f4"), ("z", "<f4")])
        rec = np.empty(n, dtype=dt)
        rec["x"] = points[:, 0]
        rec["y"] = points[:, 1]
        rec["z"] = points[:, 2]

    with open(path, "wb") as f:
        f.write(header_bytes)
        rec.tofile(f)
    return n
