from __future__ import annotations

import argparse
import hashlib
import json
import os
import secrets
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path

import depthai as dai
import numpy as np
import open3d as o3d
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

import bundle as bundle_mod
import ply_writer
import signer
from backend import BackendClient, BackendError

ROOT = Path(__file__).parent
SCANS_DIR = ROOT / "scans"
SCANS_DIR.mkdir(exist_ok=True)

# Capture-mode → on-chain mint mode (backend expects 0|1|2).
# photo + cloud are object captures (single object, possibly multi-frame);
# video is a spatial recording (continuous frame stream).
MINT_MODE_BY_CAPTURE = {"photo": 1, "cloud": 1, "video": 2}
BUNDLE_MODE_BY_CAPTURE = {"photo": "objectCapture", "cloud": "objectCapture",
                          "video": "spatial"}


def _local_nonce() -> str:
    """Cryptographically random 32-byte nonce used when the backend is
    unreachable ('Space Mode'). The bundle still has a `nonce` field for
    canonical hashing; it's just not cosmically derived."""
    return "0x" + secrets.token_hex(32)


def _compute_tier(nonce_source: str, has_attestation: bool) -> dict:
    """Classify a scan by its proof-of-reality witnesses.

    nonce_source ∈ {satellite, trng-derived, local}
    has_attestation: True iff the USB Armory signed the bundle hash.

    Tier label is shown in the UI and stored on the envelope so a verifier
    can immediately tell what guarantees a given scan provides."""
    if nonce_source == "satellite":
        label = "cosmic+token" if has_attestation else "cosmic"
    elif nonce_source == "trng-derived":
        label = "online+token" if has_attestation else "online"
    else:
        label = "space+token" if has_attestation else "space"
    return {
        "label": label,
        "nonce_source": nonce_source,
        "attestation": "armory" if has_attestation else "none",
    }


def _classify_nonce(nonce_resp: dict | None) -> str:
    if not nonce_resp:
        return "local"
    return "satellite" if nonce_resp.get("satSig") else "trng-derived"


def _env(name: str, default=None):
    v = os.environ.get(name)
    return v if v not in (None, "") else default


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("-d", "--device", default=None)
    p.add_argument("--fps", type=int, default=10)
    p.add_argument("--size", default="640x400")
    p.add_argument("--http-port", type=int, default=8080)
    p.add_argument("--viz-port", type=int, default=8082)
    p.add_argument("--viz-url", default=None)
    p.add_argument("--gotee-host", default=_env("GOTEE_HOST", "10.0.0.1"))
    p.add_argument("--gotee-port", type=int, default=int(_env("GOTEE_PORT", 4000)))
    p.add_argument("--no-sign", action="store_true")
    p.add_argument("--voxel-size", type=float, default=0.01,
                   help="TSDF voxel length in metres (cloud mode). 0.01 m "
                        "(1 cm) gives sharp close-object detail; the grid "
                        "pattern visible on flat surfaces at 0.02 m is "
                        "the voxel grid showing through.")
    p.add_argument("--sdf-trunc", type=float, default=0.03,
                   help="TSDF truncation distance in metres (cloud mode). "
                        "Kept at 3x voxel-size --- standard ratio.")
    p.add_argument("--depth-max", type=float, default=2.0,
                   help="Drop depths beyond this (metres). Tighter values "
                        "(1.5-2.5 m) keep the cloud focused on close "
                        "objects, reduce far-field stereo noise (precision "
                        "scales as z^2), and stabilise odometry by "
                        "rejecting unreliable far features. Raise for "
                        "whole-room or outdoor capture.")
    p.add_argument("--video-max-frames", type=int, default=600,
                   help="Hard cap on video-mode frames to bound RAM use")
    p.add_argument("--backend-url", default=_env("BACKEND_URL"),
                   help="proof-of-reality backend (e.g. https://proof-of-reality-api.vercel.app). "
                        "Empty = backend disabled, scans stay local.")
    p.add_argument("--shared-secret",
                   default=_env("CAMERA_SHARED_SECRET", _env("IOS_SHARED_SECRET")),
                   help="X-Camera-Key for the backend. Reads CAMERA_SHARED_SECRET first, "
                        "then falls back to IOS_SHARED_SECRET.")
    p.add_argument("--device-bundle-id",
                   default=_env("DEVICE_BUNDLE_ID", "io.luxonis.scan-and-sign"))
    p.add_argument("--no-mint", action="store_true",
                   help="Build + sign locally but skip backend upload/mint.")
    a = p.parse_args()
    w, h = (int(v) for v in a.size.lower().split("x"))
    a.size = (w, h)
    return a


def _imgframe_to_np(msg):
    return msg.getCvFrame()


def project_pcl(color_bgr, depth_u16, K, depth_min=0.1, depth_max=5.0):
    """Back-project a single (BGR colour, uint16 mm depth) frame into a
    coloured point cloud using the supplied 3x3 intrinsics matrix."""
    h, w = depth_u16.shape
    fx, fy, cx, cy = K[0, 0], K[1, 1], K[0, 2], K[1, 2]
    z = depth_u16.astype(np.float32) / 1000.0  # mm → metres
    mask = (z > depth_min) & (z < depth_max) & np.isfinite(z)
    ys, xs = np.indices((h, w))
    x = (xs - cx) * z / fx
    y = (ys - cy) * z / fy
    pts = np.stack([x[mask], y[mask], z[mask]], axis=-1).astype(np.float32)
    rgb = color_bgr[..., ::-1]  # BGR → RGB
    cols = rgb[mask].astype(np.uint8)
    return pts, cols


class CaptureManager:
    """Owns the latest synced frame from the depthai pipeline and one
    optional active recording (video or cloud). Photo mode is a snapshot
    of the latest frame and skips the recording lifecycle entirely.

    The pipeline thread calls feed() on every new (color, depth) pair.
    HTTP handlers call take_photo() / start_recording() / stop_recording().
    """

    def __init__(self, voxel_size=0.02, sdf_trunc=0.06,
                 depth_max=5.0, video_max_frames=600):
        self.lock = threading.Lock()
        # latest frame
        self.color = None     # ndarray BGR (H, W, 3) uint8
        self.depth = None     # ndarray uint16 (H, W) in mm
        self.ts_ns = None
        # intrinsics (set once at startup)
        self.K = None
        self.K_o3d = None
        self.W = None
        self.H = None
        # active recording (only one at a time)
        self.mode = None      # 'video' | 'cloud' | None
        self.scan_id = None
        self.t_start = None
        # cloud-mode state
        self.tsdf = None
        self.last_rgbd = None
        self.pose = np.eye(4)
        self.cloud_updates = 0
        # video-mode state
        self.video_frames = []
        # tuning
        self.voxel_size = voxel_size
        self.sdf_trunc = sdf_trunc
        self.depth_max = depth_max
        self.video_max_frames = video_max_frames

    def set_intrinsics(self, K, w, h):
        K_o3d = o3d.camera.PinholeCameraIntrinsic()
        K_o3d.set_intrinsics(w, h, K[0, 0], K[1, 1], K[0, 2], K[1, 2])
        with self.lock:
            self.K = np.asarray(K, dtype=np.float64)
            self.K_o3d = K_o3d
            self.W, self.H = int(w), int(h)

    def feed(self, color_bgr, depth_u16, ts_ns):
        with self.lock:
            self.color = color_bgr
            self.depth = depth_u16
            self.ts_ns = ts_ns
            if self.mode == 'cloud':
                self._integrate_cloud_locked(color_bgr, depth_u16)
            elif self.mode == 'video':
                if len(self.video_frames) < self.video_max_frames:
                    self.video_frames.append(
                        (color_bgr.copy(), depth_u16.copy(), ts_ns))

    def _integrate_cloud_locked(self, color_bgr, depth_u16):
        if self.K_o3d is None:
            return
        try:
            rgb = np.ascontiguousarray(color_bgr[..., ::-1])
            depth = np.ascontiguousarray(depth_u16)
            rgbd = o3d.geometry.RGBDImage.create_from_color_and_depth(
                o3d.geometry.Image(rgb),
                o3d.geometry.Image(depth),
                depth_scale=1000.0,
                depth_trunc=self.depth_max,
                convert_rgb_to_intensity=False,
            )
            if self.last_rgbd is not None:
                opt = o3d.pipelines.odometry.OdometryOption()
                opt.depth_max = self.depth_max
                # depth_diff_max defaults to 3 cm; tighter (1.5 cm) rejects
                # frame-pairs whose warped depth disagrees more than that ---
                # those are typically the pose-slip frames that produce the
                # duplicated-geometry artifacts visible at 3 cm tolerance.
                opt.depth_diff_max = 0.015
                ok, T_rel, _ = o3d.pipelines.odometry.compute_rgbd_odometry(
                    rgbd, self.last_rgbd, self.K_o3d, np.eye(4),
                    o3d.pipelines.odometry.RGBDOdometryJacobianFromHybridTerm(),
                    opt,
                )
                if ok:
                    self.pose = self.pose @ T_rel
            self.last_rgbd = rgbd
            self.tsdf.integrate(rgbd, self.K_o3d, np.linalg.inv(self.pose))
            self.cloud_updates += 1
        except Exception as e:
            print(f"[cloud] integrate failed: {type(e).__name__}: {e}")

    def start_recording(self, mode):
        with self.lock:
            if self.mode is not None:
                return None
            if self.color is None or self.K is None:
                return None
            scan_id = uuid.uuid4().hex[:12]
            self.scan_id = scan_id
            self.t_start = time.time()
            self.mode = mode
            if mode == 'cloud':
                self.tsdf = o3d.pipelines.integration.ScalableTSDFVolume(
                    voxel_length=self.voxel_size,
                    sdf_trunc=self.sdf_trunc,
                    color_type=o3d.pipelines.integration.TSDFVolumeColorType.RGB8,
                )
                self.last_rgbd = None
                self.pose = np.eye(4)
                self.cloud_updates = 0
            elif mode == 'video':
                self.video_frames = []
            else:
                self.mode = None
                self.scan_id = None
                self.t_start = None
                return None
            return scan_id

    def stop_recording(self):
        with self.lock:
            if self.mode is None:
                return None
            mode = self.mode
            payload = {
                'mode': mode,
                'scan_id': self.scan_id,
                't_start': self.t_start,
                't_end': time.time(),
            }
            if mode == 'cloud':
                if self.tsdf:
                    payload['pcd'] = self.tsdf.extract_point_cloud()
                    payload['mesh'] = self.tsdf.extract_triangle_mesh()
                else:
                    payload['pcd'] = None
                    payload['mesh'] = None
                payload['updates'] = self.cloud_updates
            elif mode == 'video':
                payload['frames'] = self.video_frames
                self.video_frames = []
            self.mode = None
            self.scan_id = None
            self.t_start = None
            self.tsdf = None
            self.last_rgbd = None
            self.cloud_updates = 0
            return payload

    def take_photo(self):
        with self.lock:
            if self.color is None or self.K is None:
                return None
            color = self.color.copy()
            depth = self.depth.copy()
            K = self.K.copy()
            ts = time.time()
        pts, cols = project_pcl(color, depth, K, depth_max=self.depth_max)
        return {
            'mode': 'photo',
            'scan_id': uuid.uuid4().hex[:12],
            'pts': pts, 'cols': cols,
            't_start': ts, 't_end': ts,
        }


def _load_intrinsics(device, socket, width, height, mgr):
    try:
        calib = device.readCalibration()
        K = np.array(calib.getCameraIntrinsics(socket, width, height),
                     dtype=np.float64)
        mgr.set_intrinsics(K, width, height)
        print(f"intrinsics fx={K[0,0]:.1f} fy={K[1,1]:.1f} "
              f"cx={K[0,2]:.1f} cy={K[1,2]:.1f}")
    except Exception as e:
        print(f"[intrinsics] failed: {e}")


def build_pipeline(args, mgr, stop_event):
    visualizer = dai.RemoteConnection(httpPort=args.viz_port)
    device = dai.Device(dai.DeviceInfo(args.device)) if args.device else dai.Device()
    if not device.setIrLaserDotProjectorIntensity(1):
        print("Note: device does not support IR laser intensity control.")

    with dai.Pipeline(device) as pipeline:
        platform = device.getPlatform()
        WIDTH, HEIGHT = args.size

        left = pipeline.create(dai.node.Camera).build(dai.CameraBoardSocket.CAM_B)
        right = pipeline.create(dai.node.Camera).build(dai.CameraBoardSocket.CAM_C)
        cam = pipeline.create(dai.node.Camera).build(dai.CameraBoardSocket.CAM_A)

        # Lock auto-exposure on the colour camera once the pipeline starts.
        # Frame-to-frame brightness changes from AE re-balancing show up
        # as photometric "motion" to the visual odometry matcher and are
        # a top contributor to pose drift on otherwise-static scenes.
        cam.initialControl.setAutoExposureLock(True)

        left_out = left.requestOutput((WIDTH, HEIGHT), type=dai.ImgFrame.Type.NV12, fps=args.fps)
        right_out = right.requestOutput((WIDTH, HEIGHT), type=dai.ImgFrame.Type.NV12, fps=args.fps)
        cam_out = cam.requestOutput((WIDTH, HEIGHT), type=dai.ImgFrame.Type.RGB888i, fps=args.fps)

        stereo = pipeline.create(dai.node.StereoDepth).build(
            left=left_out, right=right_out,
            presetMode=dai.node.StereoDepth.PresetMode.DENSITY,
        )
        # Subpixel ~halves depth-step quantisation past ~1 m; LR-check rejects
        # pixels that don't agree across the two stereo views (kills most
        # one-pixel "ghost" depths around object boundaries).
        stereo.setSubpixel(True)
        stereo.setLeftRightCheck(True)

        # Depth post-processing (runs in the StereoDepth node before
        # ImageAlign, so the aligned depth we read is already filtered):
        #   * temporal — averages depth across frames; massive SNR boost
        #     on the static parts of a room scan, the main source of cloud
        #     "fizz" on flat walls.
        #   * speckle  — drops small islands of disparity that don't agree
        #     with their neighbours (sensor noise / mismatches).
        #   * threshold — clamps depth to (depth_min_mm, depth_max_mm) so
        #     wildly-out-of-range pixels never reach the TSDF.
        pp = stereo.initialConfig.postProcessing
        pp.temporalFilter.enable = True
        pp.speckleFilter.enable = True
        pp.thresholdFilter.minRange = 200  # mm
        pp.thresholdFilter.maxRange = int(args.depth_max * 1000)

        if platform == dai.Platform.RVC4:
            align = pipeline.create(dai.node.ImageAlign)
            stereo.depth.link(align.input)
            cam_out.link(align.inputAlignTo)
            depth_out = align.outputAligned
        else:
            cam_out.link(stereo.inputAlignTo)
            depth_out = stereo.depth

        sync = pipeline.create(dai.node.Sync)
        cam_out.link(sync.inputs["color"])
        depth_out.link(sync.inputs["depth"])
        sync_q = sync.out.createOutputQueue(maxSize=2, blocking=False)

        visualizer.addTopic("preview", cam_out)

        pipeline.start()
        visualizer.registerPipeline(pipeline)
        _load_intrinsics(device, dai.CameraBoardSocket.CAM_A, WIDTH, HEIGHT, mgr)
        print(f"Pipeline running. Visualizer at http://localhost:{args.viz_port}")

        while not stop_event.is_set() and pipeline.isRunning():
            try:
                grp = sync_q.tryGet()
                if grp is None:
                    time.sleep(0.01)
                    continue
                color_msg = grp["color"]
                depth_msg = grp["depth"]
                if color_msg is None or depth_msg is None:
                    continue
                color = _imgframe_to_np(color_msg)
                depth = _imgframe_to_np(depth_msg)
                if color is None or depth is None:
                    continue
                try:
                    ts_ns = int(color_msg.getTimestamp().total_seconds() * 1e9)
                except Exception:
                    ts_ns = int(time.time_ns())
                mgr.feed(color, depth, ts_ns)
            except Exception as e:
                print(f"[pipeline] loop error: {type(e).__name__}: {e}")
                break


# ────────────────────────── output writers ──────────────────────────

def write_photo(scan_id, pts, cols):
    path = SCANS_DIR / f"{scan_id}.ply"
    n = ply_writer.write_binary_ply(str(path), pts, cols)
    return path, {'point_count': int(n), 'artifact': path.name}


def _clean_mesh(mesh):
    """Sanitise a TSDF-extracted triangle mesh for "best quality" output.

    Order matters: dedup first so the manifold and floating-fragment
    passes operate on the smallest valid mesh.
    """
    mesh.remove_duplicated_vertices()
    mesh.remove_duplicated_triangles()
    mesh.remove_degenerate_triangles()
    mesh.remove_unreferenced_vertices()
    mesh.remove_non_manifold_edges()

    # Drop floating fragments. The previous "keep only the largest
    # cluster" was too aggressive --- a real subject often gets split
    # into several big chunks by depth-discontinuity gaps, and dropping
    # all but one produced the Swiss-cheese holes visible on early
    # captures. Threshold by triangle count instead: drop clusters
    # smaller than max(50, 1% of total). Tiny orphans go, big chunks
    # of the subject stay.
    if len(mesh.triangles) > 0:
        clusters, n_per, _ = mesh.cluster_connected_triangles()
        if len(n_per) > 0:
            n_per_arr = np.asarray(n_per)
            min_keep = max(50, int(0.01 * n_per_arr.sum()))
            keep_set = set(int(i) for i in np.where(n_per_arr >= min_keep)[0])
            # Always retain the largest cluster, even if it's smaller than
            # the threshold --- guards tiny meshes (e.g. test fixtures, or
            # a scan that integrated very few frames) from being wiped.
            keep_set.add(int(np.argmax(n_per_arr)))
            drop = np.array([c not in keep_set for c in clusters])
            if drop.any():
                mesh.remove_triangles_by_mask(drop)
                mesh.remove_unreferenced_vertices()

    # Note: Taubin smoothing was applied here previously, but on the
    # already-noisy TSDF marching-cubes output it produced a melted /
    # lumpy look without buying real quality. Skip --- callers who
    # want a smoother surface should consume the Poisson artifact.
    mesh.compute_vertex_normals()
    return mesh


_POISSON_TIMEOUT_S = 180


def _poisson_reconstruct(scan_id, pcd_path):
    """Run Poisson reconstruction in a subprocess.

    The previous in-process version could take down the FastAPI server
    when Open3D's Poisson C++ code crashed (the "Failed to close loop"
    isosurface path, or kernel OOM-killer on the OAK4). A subprocess
    contains the blast radius: any C++ abort / OOM kill / Python crash
    in the worker yields a non-zero exit, which we treat as "no Poisson
    artifact this scan" and the rest of the envelope is unaffected.

    Returns (out_path, info_dict) on success, (None, None) otherwise.
    Set POISSON_DISABLE=1 to skip entirely (recommended if you're
    debugging some other crash and want to exclude Poisson as a
    suspect).
    """
    if os.environ.get("POISSON_DISABLE") == "1":
        return None, None

    worker = ROOT / "poisson_worker.py"
    if not worker.exists():
        print(f"[poisson] worker missing at {worker}, skipping")
        return None, None

    out_path = SCANS_DIR / f"{scan_id}.poisson.ply"
    try:
        proc = subprocess.run(
            [sys.executable, str(worker), str(pcd_path), str(out_path)],
            capture_output=True, timeout=_POISSON_TIMEOUT_S,
        )
    except subprocess.TimeoutExpired:
        print(f"[poisson] worker timed out after {_POISSON_TIMEOUT_S}s")
        return None, None
    except Exception as e:
        print(f"[poisson] subprocess.run failed: {type(e).__name__}: {e}")
        return None, None

    stdout = proc.stdout.decode("utf-8", "replace").strip()
    stderr = proc.stderr.decode("utf-8", "replace").strip()
    if proc.returncode != 0:
        print(f"[poisson] worker exit={proc.returncode} "
              f"stdout={stdout!r} stderr={stderr!r}")
        return None, None

    info = {}
    if stdout:
        try:
            info = json.loads(stdout.splitlines()[-1])
        except Exception:
            pass

    if not out_path.exists() or out_path.stat().st_size == 0:
        print(f"[poisson] worker reported success but no output at {out_path}")
        return None, None

    return out_path, info


def write_cloud(scan_id, pcd, mesh):
    pcd_path = SCANS_DIR / f"{scan_id}.ply"
    # Strip statistical outliers before writing: Open3D's TSDF emits
    # isolated points around depth-discontinuity edges and on
    # uncertain pixels. nb_neighbors=20 / std_ratio=2.0 is a
    # conservative setting (drops ~5% on a typical room scan) that
    # cleans the cloud without eating real geometry.
    raw = int(len(pcd.points))
    if raw > 50:
        pcd, _ = pcd.remove_statistical_outlier(nb_neighbors=20, std_ratio=2.0)
    kept = int(len(pcd.points))
    o3d.io.write_point_cloud(str(pcd_path), pcd, write_ascii=False, compressed=False)

    extra = {'point_count': kept, 'point_count_raw': raw,
             'outliers_dropped': raw - kept, 'artifact': pcd_path.name}

    # Mesh is extracted from the same TSDF volume, so it's effectively
    # free given we already paid for the integration. Keep both as
    # separate artifacts; the .ply is the signed primary, the .mesh.ply
    # is a sibling whose own SHA goes into the envelope so downstream
    # consumers can verify it independently.
    if mesh is not None and len(mesh.triangles) > 0:
        mesh = _clean_mesh(mesh)
        if len(mesh.triangles) > 0:
            mesh_path = SCANS_DIR / f"{scan_id}.mesh.ply"
            o3d.io.write_triangle_mesh(str(mesh_path), mesh, write_ascii=False)
            extra['mesh_artifact'] = mesh_path.name
            extra['mesh_sha256'] = _hash_file(mesh_path)
            extra['vertex_count'] = int(len(mesh.vertices))
            extra['triangle_count'] = int(len(mesh.triangles))

    # Poisson reconstruction is the "looks solid" sibling output ---
    # watertight surface that fills the holes marching-cubes leaves
    # around sparse TSDF voxels. Runs in a subprocess so any C++ crash
    # in Open3D's PoissonRecon (the `Failed to close loop` isosurface
    # path or a kernel OOM-kill on the OAK4) is contained; the primary
    # PCD + marching-cubes mesh on disk above are unaffected.
    poisson_path, poisson_info = _poisson_reconstruct(scan_id, pcd_path)
    if poisson_path is not None:
        extra['poisson_artifact'] = poisson_path.name
        extra['poisson_sha256'] = _hash_file(poisson_path)
        extra['poisson_vertex_count'] = int(poisson_info.get('vertex_count', 0))
        extra['poisson_triangle_count'] = int(poisson_info.get('triangle_count', 0))

    return pcd_path, extra


def write_video(scan_id, frames, K, w, h, fps):
    """Stack frames into a single compressed .npz. Layout:
        color: (N, H, W, 3) uint8 (BGR — same as depthai cvFrame)
        depth: (N, H, W)    uint16 (mm)
        ts_ns: (N,)         int64
        K:     (3, 3)       float64
        meta:  json bytes (uint8 view)
    """
    if not frames:
        raise ValueError("no frames captured")
    color = np.stack([f[0] for f in frames], axis=0)
    depth = np.stack([f[1] for f in frames], axis=0)
    ts_ns = np.array([f[2] for f in frames], dtype=np.int64)
    meta = json.dumps({
        "version": 1, "width": int(w), "height": int(h),
        "fps": float(fps), "frame_count": int(len(frames)),
        "color_layout": "BGR uint8 (H,W,3)",
        "depth_layout": "uint16 mm (H,W)",
    }).encode()
    path = SCANS_DIR / f"{scan_id}.npz"
    with open(path, "wb") as f:
        np.savez_compressed(f, color=color, depth=depth, ts_ns=ts_ns,
                            K=np.asarray(K, dtype=np.float64),
                            meta=np.frombuffer(meta, dtype=np.uint8))
    return path, {
        'frame_count': int(len(frames)),
        'point_count': None,
        'artifact': path.name,
    }


def _hash_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def make_app(args, mgr, backend: BackendClient | None):
    app = FastAPI()
    app.mount("/static", StaticFiles(directory=str(ROOT / "static")), name="static")

    def _finalize(snap, artifact_path, extra):
        """Build the canonical bundle, sign it, and try to mint.

        Tiered degradation:
          - Backend reachable → cTRNG/satellite nonce; otherwise generate a
            local urandom nonce (Space Mode).
          - Armory plugged in → sign the bundle hash; otherwise mint with
            attestation 'MOCK'.
          - Backend reachable + nonce_resp present → upload + mint immediately.
            Otherwise persist the bundle + Armory sig with mint_pending=true
            so /retry-mint/<scan_id> can replay later.
        """
        sha = _hash_file(artifact_path)
        capture_mode = snap['mode']
        envelope = {
            "scan_id": snap['scan_id'],
            "mode": capture_mode,
            "artifact": artifact_path.name,
            "artifact_sha256": sha,
            "ply_sha256": sha,  # legacy alias
            "size": list(args.size),
            "fps": args.fps,
            "ts": int(snap['t_end']),
            "duration_s": round(snap['t_end'] - snap['t_start'], 3),
            "gotee": None,
            "bundle": None,
            "bundle_hash": None,
            "backend": None,
            "mint": None,
            "tier": None,
            "mint_pending": False,
            **extra,
        }

        # Step 1: nonce. Try backend first; fall back to local urandom (Space Mode).
        nonce_resp = None
        if backend is not None and not args.no_mint:
            try:
                nonce_resp = backend.get_nonce()
                envelope["backend"] = {"nonce": nonce_resp}
            except BackendError as e:
                envelope["backend"] = {"nonce_error": str(e)}

        if nonce_resp is not None:
            nonce_value = nonce_resp.get("nonce", "") or _local_nonce()
            sat_sig = nonce_resp.get("satSig", "")
            nonce_expires_at = int(nonce_resp.get("expiresAt", snap['t_end']))
        else:
            nonce_value = _local_nonce()
            sat_sig = ""
            nonce_expires_at = int(snap['t_end']) + 600

        # Step 2: canonical bundle. Always built — same shape regardless of tier.
        intrinsics = (
            (mgr.K[0, 0], mgr.K[1, 1], mgr.K[0, 2], mgr.K[1, 2],
             float(mgr.W or 0), float(mgr.H or 0)) if mgr.K is not None else None
        )
        frames = extra.get('frame_count') or extra.get('integrated') or 0
        bundle_dict, bundle_bytes, bundle_hash = bundle_mod.build(
            scene_path=artifact_path,
            scene_sha256_hex=sha,
            nonce=nonce_value,
            sat_sig=sat_sig,
            nonce_expires_at=nonce_expires_at,
            mode=BUNDLE_MODE_BY_CAPTURE[capture_mode],
            sensors_hash_hex=bundle_mod.sensors_hash(
                snap['scan_id'], snap['t_start'], snap['t_end'],
                int(frames), intrinsics,
            ),
            device_model=os.environ.get("OAK_DEVICE_MODEL", "oak"),
            device_bundle_id=args.device_bundle_id,
            created_at=int(snap['t_end']),
        )
        envelope["bundle"] = bundle_dict
        envelope["bundle_hash"] = bundle_hash
        bundle_path = SCANS_DIR / f"{snap['scan_id']}.bundle.json"
        bundle_path.write_bytes(bundle_bytes)

        # Step 3: sign with Armory if available.
        attestation_hex = ""
        has_attestation = False
        if not args.no_sign:
            try:
                gotee_env = signer.sign(
                    bundle_hash[2:],
                    host=args.gotee_host, port=args.gotee_port)
                envelope["gotee"] = gotee_env
                attestation_hex = signer.pack_attestation(gotee_env)
                has_attestation = True
            except signer.GoteeError as e:
                envelope["gotee"] = {"error": str(e)}

        # Step 4: classify the achieved proof tier.
        envelope["tier"] = _compute_tier(_classify_nonce(nonce_resp),
                                         has_attestation)

        # Step 5: mint if backend is reachable + we got a real nonce.
        # Otherwise mark mint_pending so /retry-mint can replay later.
        if backend is None or args.no_mint or nonce_resp is None:
            envelope["mint_pending"] = backend is not None and not args.no_mint
            _write_envelope(envelope, snap['scan_id'])
            return envelope

        try:
            up = backend.upload_or_local(bundle_bytes, artifact_path)
            envelope["backend"]["upload"] = up
            swarm_ref = up["swarmRef"]
            bundle_ref = (up.get("bundleRef")
                          or f"local:{bundle_hash[2:]}")
            cosmo_sig = up.get("cosmoSig")

            mint_resp = backend.mint(
                swarm_ref=swarm_ref,
                bundle_ref=bundle_ref,
                bundle_hash=bundle_hash,
                sat_sig=sat_sig,
                cosmo_sig=cosmo_sig,
                attestation=attestation_hex or "MOCK",
                attestation_type=1,
                captured_at=int(snap['t_end']),
                mode=MINT_MODE_BY_CAPTURE[capture_mode],
            )
            envelope["mint"] = mint_resp
        except BackendError as e:
            envelope["backend"]["error"] = str(e)
            envelope["mint_pending"] = True
        except Exception as e:
            envelope["backend"]["error"] = f"{type(e).__name__}: {e}"
            envelope["mint_pending"] = True

        _write_envelope(envelope, snap['scan_id'])
        return envelope

    def _write_envelope(envelope, scan_id):
        env_path = SCANS_DIR / f"{scan_id}.json"
        env_path.write_text(json.dumps(envelope, indent=2))

    @app.get("/", response_class=HTMLResponse)
    def index():
        return (ROOT / "static" / "index.html").read_text()

    @app.get("/config")
    def config():
        return {"viz_port": args.viz_port, "viz_url": args.viz_url,
                "fps": args.fps, "size": list(args.size),
                "no_sign": bool(args.no_sign),
                "no_mint": bool(args.no_mint or backend is None),
                "backend_url": args.backend_url or None,
                "video_max_frames": args.video_max_frames}

    @app.get("/healthz")
    def healthz():
        connected, msg = signer.token_status(args.gotee_host, args.gotee_port)
        backend_ok = False
        backend_msg = "disabled"
        if backend is not None:
            try:
                backend.health()
                backend_ok = True
                backend_msg = backend.base_url
            except BackendError as e:
                backend_msg = str(e)
        # Achievable tier *right now* — assumes a fresh nonce will succeed if
        # the backend is up. Treats backend reachability as a proxy for
        # eventual satellite signing; we won't know until we actually call
        # /api/nonce whether satSig is populated, so we report the optimistic
        # case ('cosmic') and let _classify_nonce downgrade per-scan.
        nonce_source = "trng-derived" if backend_ok else "local"
        # 'cosmic' is the optimistic upper bound when backend is up.
        if backend_ok:
            nonce_source = "satellite"
        achievable = _compute_tier(nonce_source, connected)
        return {
            "token": {"connected": connected, "msg": msg,
                      "host": args.gotee_host, "port": args.gotee_port},
            "backend": {"ok": backend_ok, "msg": backend_msg,
                        "url": backend.base_url if backend else None},
            "tier": achievable,
            "ready": connected and (backend_ok or backend is None),
        }

    @app.post("/retry-mint/{scan_id}")
    def retry_mint(scan_id: str):
        """Replay a previously persisted bundle (typically from Space Mode)
        through upload + mint when the backend comes back online. The
        bundle bytes on disk are the canonical hash-source — we re-send
        them verbatim, so the on-chain bundleHash matches what the
        Armory already signed."""
        if "/" in scan_id or ".." in scan_id:
            raise HTTPException(400, "bad scan_id")
        env_path = SCANS_DIR / f"{scan_id}.json"
        bundle_path = SCANS_DIR / f"{scan_id}.bundle.json"
        if not env_path.exists():
            raise HTTPException(404, "envelope not found")
        if not bundle_path.exists():
            raise HTTPException(409, "bundle.json missing — scan was local-only")
        if backend is None:
            raise HTTPException(503, "backend not configured")
        envelope = json.loads(env_path.read_text())
        if envelope.get("mint", {}).get("txHash"):
            return {"status": "already_minted", "mint": envelope["mint"]}

        bundle_bytes = bundle_path.read_bytes()
        artifact_path = SCANS_DIR / envelope["artifact"]
        if not artifact_path.exists():
            raise HTTPException(404, "scene artifact missing")

        gotee = envelope.get("gotee") or {}
        attestation_hex = (signer.pack_attestation(gotee)
                           if "mac" in gotee else "MOCK")
        bundle = envelope.get("bundle") or {}
        sat_sig = bundle.get("satSig", "")
        capture_mode = envelope.get("mode", "cloud")

        try:
            up = backend.upload_or_local(bundle_bytes, artifact_path)
            mint_resp = backend.mint(
                swarm_ref=up["swarmRef"],
                bundle_ref=up.get("bundleRef") or f"local:{envelope['bundle_hash'][2:]}",
                bundle_hash=envelope["bundle_hash"],
                sat_sig=sat_sig,
                cosmo_sig=up.get("cosmoSig"),
                attestation=attestation_hex,
                attestation_type=1,
                captured_at=int(envelope["ts"]),
                mode=MINT_MODE_BY_CAPTURE.get(capture_mode, 1),
            )
        except BackendError as e:
            raise HTTPException(502, f"retry failed: {e}")

        envelope["backend"] = (envelope.get("backend") or {})
        envelope["backend"]["upload"] = up
        envelope["mint"] = mint_resp
        envelope["mint_pending"] = False
        # Tier of a retried mint reflects what was *captured*, not what's now
        # achievable — keep the original tier label; only the mint state changed.
        env_path.write_text(json.dumps(envelope, indent=2))
        return envelope

    @app.post("/capture/photo")
    def capture_photo():
        snap = mgr.take_photo()
        if snap is None:
            raise HTTPException(503, "pipeline not ready (no frames yet)")
        if snap['pts'].shape[0] == 0:
            raise HTTPException(400, "no valid depth in current frame")
        path, extra = write_photo(snap['scan_id'], snap['pts'], snap['cols'])
        return _finalize(snap, path, extra)

    @app.post("/record/start/{mode}")
    def record_start(mode: str):
        if mode not in ('video', 'cloud'):
            raise HTTPException(400, "mode must be 'video' or 'cloud'")
        scan_id = mgr.start_recording(mode)
        if scan_id is None:
            raise HTTPException(409, "already recording or pipeline not ready")
        return {"scan_id": scan_id, "mode": mode, "status": "recording"}

    @app.post("/record/stop")
    def record_stop():
        snap = mgr.stop_recording()
        if snap is None:
            raise HTTPException(409, "not recording")
        if snap['mode'] == 'cloud':
            pcd = snap.get('pcd')
            if snap.get('updates', 0) == 0 or pcd is None or len(pcd.points) == 0:
                raise HTTPException(400, "TSDF integrated no frames — "
                                         "VIO may not have converged. Move slower.")
            path, extra = write_cloud(snap['scan_id'], pcd, snap.get('mesh'))
            extra['integrated'] = snap.get('updates', 0)
            return _finalize(snap, path, extra)
        if snap['mode'] == 'video':
            frames = snap.get('frames') or []
            if not frames:
                raise HTTPException(400, "no frames captured")
            path, extra = write_video(
                snap['scan_id'], frames, mgr.K, mgr.W, mgr.H, args.fps)
            return _finalize(snap, path, extra)
        raise HTTPException(500, f"unknown mode {snap['mode']!r}")

    @app.get("/record/state")
    def record_state():
        with mgr.lock:
            elapsed = (time.time() - mgr.t_start) if mgr.mode else 0
            count = (mgr.cloud_updates if mgr.mode == 'cloud'
                     else (len(mgr.video_frames) if mgr.mode == 'video' else 0))
            return {
                "recording": mgr.mode is not None,
                "mode": mgr.mode,
                "scan_id": mgr.scan_id,
                "frame_count": count,
                "elapsed_s": round(elapsed, 2),
            }

    @app.get("/scans")
    def list_scans():
        out = []
        for p in sorted(SCANS_DIR.glob("*.json"), reverse=True):
            try:
                out.append(json.loads(p.read_text()))
            except Exception:
                continue
        return out

    @app.get("/scans/{filename}")
    def get_scan_artifact(filename: str):
        if "/" in filename or ".." in filename:
            raise HTTPException(400, "bad filename")
        p = SCANS_DIR / filename
        if not p.exists():
            raise HTTPException(404)
        media = ("application/json" if filename.endswith(".json")
                 else "application/octet-stream")
        return FileResponse(str(p), media_type=media, filename=filename)

    @app.get("/debug/network")
    def debug_network():
        import subprocess as sp
        cmds = [
            ("nc_bridge", f"nc -zv -w 3 {args.gotee_host} {args.gotee_port}"),
            ("hostname_ip", "hostname -I"),
            ("which_nc", "which nc"),
        ]
        out = {}
        for name, cmd in cmds:
            try:
                p = sp.run(["sh", "-c", cmd], capture_output=True, timeout=5)
                out[name] = {
                    "cmd": cmd, "exit": p.returncode,
                    "stdout": p.stdout.decode("utf-8", "replace").strip(),
                    "stderr": p.stderr.decode("utf-8", "replace").strip(),
                }
            except Exception as e:
                out[name] = {"cmd": cmd, "error": f"{type(e).__name__}: {e}"}
        return out

    return app


def main():
    args = parse_args()
    mgr = CaptureManager(
        voxel_size=args.voxel_size,
        sdf_trunc=args.sdf_trunc,
        depth_max=args.depth_max,
        video_max_frames=args.video_max_frames,
    )
    stop_event = threading.Event()

    backend: BackendClient | None = None
    if args.backend_url and args.shared_secret:
        backend = BackendClient(args.backend_url, args.shared_secret)
        print(f"[backend] {args.backend_url} (auth: X-Camera-Key)")
    elif args.backend_url and not args.shared_secret:
        print("[backend] BACKEND_URL set but CAMERA_SHARED_SECRET / IOS_SHARED_SECRET "
              "missing — backend disabled")
    else:
        print("[backend] disabled (BACKEND_URL not set) — scans stay local")

    def pipeline_thread():
        try:
            build_pipeline(args, mgr, stop_event)
        except Exception as e:
            print(f"[pipeline] crashed: {e}")
            stop_event.set()
            os._exit(1)

    t = threading.Thread(target=pipeline_thread, daemon=True)
    t.start()

    app = make_app(args, mgr, backend)
    print(f"[http] control panel  http://0.0.0.0:{args.http_port}/")
    print(f"[http] live preview   http://0.0.0.0:{args.viz_port}/")
    try:
        uvicorn.run(app, host="0.0.0.0", port=args.http_port, log_level="info")
    finally:
        stop_event.set()


if __name__ == "__main__":
    main()
