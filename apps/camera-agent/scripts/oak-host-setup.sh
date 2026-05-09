#!/bin/sh
# Run on the OAK4 host (SSH'd in as root) to make the gotee bridge
# reachable from the oakapp container.
#
#   ssh root@<oak-ip> 'sh -' < scripts/oak-host-setup.sh
#
# Idempotent: re-run after a USB cycle / SSH reset to rebuild the link
# and the forwarder.

set -eu

# 1) Bring up usb0 with 10.0.0.2/24 so the OAK can reach the Armory
#    bridge at 10.0.0.1. CDC-ECM names it usb0 by default.
ip link set usb0 up
ip addr show usb0 | grep -q 'inet 10\.0\.0\.2' \
    || ip addr add 10.0.0.2/24 dev usb0
ip addr show usb0 | grep inet

# 2) Sanity check: the Armory should respond on the bridge.
echo '--- bridge probe ---'
echo '{"Method":"Sign","Input":"00"}' | nc -w 5 10.0.0.1 4000 \
    || echo 'no reply — is the Armory plugged in and applet flashed?'

# 3) Restart the forwarder. We expect /tmp/forwarder.py to be present
#    (scp it from this repo: scripts/forwarder.py → /tmp/forwarder.py).
PIDFILE=/tmp/fwd.pid
if [ -f "$PIDFILE" ]; then
    OLDPID=$(cat "$PIDFILE")
    kill -9 "$OLDPID" 2>/dev/null || true
fi
rm -f /tmp/fwd.log
nohup python3 /tmp/forwarder.py > /tmp/fwd.log 2>&1 < /dev/null &
echo $! > "$PIDFILE"
sleep 1
echo '--- forwarder log ---'
cat /tmp/fwd.log

# 4) Verify locally through the forwarder
echo '--- forwarder probe ---'
echo '{"Method":"Sign","Input":"00"}' | nc -w 5 127.0.0.1 4000

echo '--- ok ---'
