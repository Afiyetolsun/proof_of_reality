#!/bin/sh
# Run on the OAK4 host as root to install the gotee forwarder as a
# systemd service that auto-starts on boot and on Armory hotplug,
# and auto-restarts if it dies.
#
# Idempotent: re-running re-installs the unit and forwarder.
#
# Usage (from your laptop):
#   scp scripts/forwarder.py scripts/oak-gotee.service scripts/install-systemd.sh root@<oak-ip>:/tmp/
#   ssh root@<oak-ip> 'sh /tmp/install-systemd.sh'
#
# Or in one shot via deploy.sh: see scripts/deploy.sh --systemd

set -eu

SRCDIR="${SRCDIR:-/tmp}"
# Some OAK images mount /opt read-only; /var/lib is reliably writable.
INSTALL_DIR=/var/lib/oak-gotee
UNIT_PATH=/etc/systemd/system/oak-gotee.service

mkdir -p "$INSTALL_DIR"
install -m 0644 "$SRCDIR/forwarder.py" "$INSTALL_DIR/forwarder.py"
install -m 0644 "$SRCDIR/oak-gotee.service" "$UNIT_PATH"

# Stop any manual forwarder we may have left running pre-systemd.
if [ -f /tmp/fwd.pid ]; then
    OLDPID=$(cat /tmp/fwd.pid)
    kill -9 "$OLDPID" 2>/dev/null || true
    rm -f /tmp/fwd.pid
fi

systemctl daemon-reload
systemctl enable oak-gotee.service
systemctl restart oak-gotee.service

sleep 1
echo '--- status ---'
systemctl --no-pager status oak-gotee.service | head -12
echo '--- usb0 ---'
ip addr show usb0 | grep -E 'state|inet' || true
echo '--- bridge probe ---'
echo '{"Method":"Sign","Input":"00"}' | nc -w 5 127.0.0.1 4000 \
    || echo '(no reply yet — Armory may not be plugged in or applet not flashed)'
