"""Client for the GoTEE Trusted Applet bridge.

The bridge speaks newline-delimited JSON over TCP (default 10.0.0.1:4000
when the Armory is plugged in directly; the OAK4 deployment routes it
through a host-side TCP forwarder — see scripts/forwarder.py).

We shell out to `nc` rather than using a Python TCP socket because
spinning up a fresh nc process per call avoids state-cycle bugs we hit
with persistent connections after USB reboots — same lesson the
gotee_starter scripts learned the hard way.
"""

import json
import shutil
import subprocess


class GoteeError(RuntimeError):
    pass


def _have_nc():
    return shutil.which("nc") is not None


def call_bridge(method, input_str, host="10.0.0.1", port=4000, timeout=5):
    if not _have_nc():
        raise GoteeError("nc not found in PATH")
    payload = json.dumps({"Method": method, "Input": input_str}) + "\n"
    print(f"[gotee] -> {host}:{port} method={method!r} payload_len={len(payload)}")
    try:
        proc = subprocess.run(
            ["nc", "-w", str(timeout), host, str(port)],
            input=payload.encode("utf-8"),
            capture_output=True,
            timeout=timeout + 2,
        )
    except subprocess.TimeoutExpired as e:
        raise GoteeError(f"nc timed out after {timeout}s") from e
    stderr = proc.stderr.decode("utf-8", "replace").strip()
    stdout = proc.stdout.decode("utf-8", "replace").strip()
    print(f"[gotee] <- exit={proc.returncode} stdout={stdout!r} stderr={stderr!r}")
    if proc.returncode != 0:
        msg = stderr or stdout or "(no output)"
        raise GoteeError(f"nc exited {proc.returncode}: {msg}")
    if not stdout:
        raise GoteeError(f"empty reply from gotee bridge (stderr: {stderr!r})")
    line = stdout.splitlines()[0]
    try:
        reply = json.loads(line)
    except json.JSONDecodeError as e:
        raise GoteeError(f"non-JSON reply: {line!r}") from e
    if "Error" in reply and reply["Error"]:
        raise GoteeError(reply["Error"])
    return reply.get("Output", "")


def sign(payload_hex, host="10.0.0.1", port=4000, timeout=5):
    """Call applet `Sign(payload_hex)`. Returns parsed envelope dict
    {device_id, nonce, mac}. Raises GoteeError on any failure."""
    out = call_bridge("Sign", payload_hex, host=host, port=port, timeout=timeout)
    try:
        env = json.loads(out)
    except json.JSONDecodeError as e:
        raise GoteeError(f"applet returned non-JSON: {out!r}") from e
    for k in ("device_id", "nonce", "mac"):
        if k not in env:
            raise GoteeError(f"applet reply missing field {k!r}: {env}")
    return env
