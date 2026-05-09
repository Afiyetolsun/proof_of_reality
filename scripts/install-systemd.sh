#!/bin/sh
# Run on the OAK4 host as root to install the gotee forwarder + its
# watchdog as systemd units. The forwarder auto-starts on boot and on
# Armory hotplug; the watchdog probes it every 30s and auto-recovers
# from silent upstream wedges.
#
# Idempotent: re-running re-installs all units and scripts.
#
# Usage (from your laptop):
#   scp scripts/forwarder.py scripts/oak-gotee.service \
#       scripts/oak-gotee-watchdog.sh scripts/oak-gotee-watchdog.service \
#       scripts/oak-gotee-watchdog.timer scripts/install-systemd.sh \
#       root@<oak-ip>:/tmp/
#   ssh root@<oak-ip> 'sh /tmp/install-systemd.sh'
#
# Or in one shot via deploy.sh: see scripts/deploy.sh --systemd

set -eu

SRCDIR="${SRCDIR:-/tmp}"
# Some OAK images mount /opt read-only; /var/lib is reliably writable.
INSTALL_DIR=/var/lib/oak-gotee
UNIT_DIR=/etc/systemd/system

mkdir -p "$INSTALL_DIR"
install -m 0644 "$SRCDIR/forwarder.py"          "$INSTALL_DIR/forwarder.py"
install -m 0755 "$SRCDIR/oak-gotee-watchdog.sh" "$INSTALL_DIR/watchdog.sh"
install -m 0644 "$SRCDIR/oak-gotee.service"             "$UNIT_DIR/oak-gotee.service"
install -m 0644 "$SRCDIR/oak-gotee-watchdog.service"    "$UNIT_DIR/oak-gotee-watchdog.service"
install -m 0644 "$SRCDIR/oak-gotee-watchdog.timer"      "$UNIT_DIR/oak-gotee-watchdog.timer"

# Stop any manual forwarder we may have left running pre-systemd.
if [ -f /tmp/fwd.pid ]; then
    OLDPID=$(cat /tmp/fwd.pid)
    kill -9 "$OLDPID" 2>/dev/null || true
    rm -f /tmp/fwd.pid
fi

systemctl daemon-reload
systemctl enable oak-gotee.service
systemctl restart oak-gotee.service
# The watchdog itself is oneshot — only the *timer* needs to be enabled
# and started. The timer fires the service every 30s.
systemctl enable oak-gotee-watchdog.timer
systemctl restart oak-gotee-watchdog.timer

sleep 1
echo '--- forwarder status ---'
systemctl --no-pager status oak-gotee.service | head -10
echo '--- watchdog timer ---'
systemctl --no-pager list-timers oak-gotee-watchdog.timer --all | head -5
echo '--- usb0 ---'
ip addr show usb0 | grep -E 'state|inet' || true
echo '--- bridge probe ---'
echo '{"Method":"Sign","Input":"00"}' | nc -w 5 127.0.0.1 4000 \
    || echo '(no reply yet — Armory may not be plugged in or applet not flashed)'
