import argparse
import hashlib
import json
import os
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

import ply_writer
import signer

ROOT = Path(__file__).parent
SCANS_DIR = ROOT / "scans"
SCANS_DIR.mkdir(exist_ok=True)


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("-d", "--device", default=None)
    p.add_argument("--fps", type=int, default=10)
    p.add_argument("--size", default="640x400")
    p.add_argument("--http-port", type=int, default=8080)
    p.add_argument("--viz-port", type=int, default=8082)
    p.add_argument("--viz-url", default=None)
    p.add_argument("--gotee-host", default="10.0.0.1")
    p.add_argument("--gotee-port", type=int, default=4000)
    p.add_argument("--no-sign", action="store_true")
    p.add_argument("--voxel-size", type=float, default=0.02,
                   help="TSDF voxel length in metres (cloud mode)")
    p.add_argument("--sdf-trunc", type=float, default=0.06,
                   help="TSDF truncation distance in metres (cloud mode)")
    p.add_argument("--depth-max", type=float, default=5.0,
                   help="Drop depths beyond this (metres)")
    p.add_argument("--video-max-frames", type=int, default=600,
                   help="Hard cap on video-mode frames to bound RAM use")
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
                payload['pcd'] = self.tsdf.extract_point_cloud() if self.tsdf else None
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


def write_cloud(scan_id, pcd):
    path = SCANS_DIR / f"{scan_id}.ply"
    o3d.io.write_point_cloud(str(path), pcd, write_ascii=False, compressed=False)
    return path, {'point_count': int(len(pcd.points)), 'artifact': path.name}


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


def make_app(args, mgr):
    app = FastAPI()
    app.mount("/static", StaticFiles(directory=str(ROOT / "static")), name="static")

    def _finalize(snap, artifact_path, extra):
        sha = _hash_file(artifact_path)
        envelope = {
            "scan_id": snap['scan_id'],
            "mode": snap['mode'],
            "artifact": artifact_path.name,
            "artifact_sha256": sha,
            "ply_sha256": sha,  # legacy alias
            "size": list(args.size),
            "fps": args.fps,
            "ts": int(snap['t_end']),
            "duration_s": round(snap['t_end'] - snap['t_start'], 3),
            "gotee": None,
            **extra,
        }
        if not args.no_sign:
            try:
                envelope['gotee'] = signer.sign(
                    sha, host=args.gotee_host, port=args.gotee_port)
            except signer.GoteeError as e:
                envelope['gotee'] = {"error": str(e)}
        env_path = SCANS_DIR / f"{snap['scan_id']}.json"
        env_path.write_text(json.dumps(envelope, indent=2))
        return envelope

    @app.get("/", response_class=HTMLResponse)
    def index():
        return (ROOT / "static" / "index.html").read_text()

    @app.get("/config")
    def config():
        return {"viz_port": args.viz_port, "viz_url": args.viz_url,
                "fps": args.fps, "size": list(args.size),
                "no_sign": bool(args.no_sign),
                "video_max_frames": args.video_max_frames}

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
            path, extra = write_cloud(snap['scan_id'], pcd)
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

    def pipeline_thread():
        try:
            build_pipeline(args, mgr, stop_event)
        except Exception as e:
            print(f"[pipeline] crashed: {e}")
            stop_event.set()
            os._exit(1)

    t = threading.Thread(target=pipeline_thread, daemon=True)
    t.start()

    app = make_app(args, mgr)
    try:
        uvicorn.run(app, host="0.0.0.0", port=args.http_port, log_level="info")
    finally:
        stop_event.set()


if __name__ == "__main__":
    main()
