#!/bin/sh
# Probes the local gotee forwarder and recovers when the upstream Armory
# bridge wedges silently — i.e. the forwarder process is alive (so
# Restart=always doesn't fire) but signing requests time out.
#
# Driven by oak-gotee-watchdog.timer (default: every 30s, starting 60s
# after boot so the forwarder + usb0 have a chance to come up cleanly).
#
# Recoverable failure modes:
#   - Forwarder TCP accept loop alive but upstream 10.0.0.1:4000 dead
#     → restart the forwarder service (its ExecStartPre re-adds the
#       usb0 static IP if it was lost).
#   - cdc_ether wedge after USB suspend/resume
#     → bounce usb0 down/up before restarting the forwarder.
#
# Unrecoverable without physical access (we just log + keep retrying):
#   - Armory physically unplugged.
#   - GoTEE applet not loaded on the Armory.
#   - Armory firmware crashed.

set -u

STATE_DIR=/run/oak-gotee-watchdog
STATE_FILE="$STATE_DIR/fails"
mkdir -p "$STATE_DIR"
[ -f "$STATE_FILE" ] || echo 0 > "$STATE_FILE"

# A real Sign request is the cheapest end-to-end probe — it exercises
# the forwarder loop, the cdc_ether link, and the Armory's applet.
# Empty input yields a deterministic short reply.
PROBE='{"Method":"Sign","Input":"00"}'
REPLY=$(echo "$PROBE" | nc -w 3 127.0.0.1 4000 2>/dev/null || true)

# Healthy reply is JSON starting with `{` (typically with Output or
# Error keys). Anything else — empty, truncated, connection refused —
# counts as a miss.
if echo "$REPLY" | grep -q '^{'; then
    echo 0 > "$STATE_FILE"
    exit 0
fi

FAILS=$(cat "$STATE_FILE")
FAILS=$((FAILS + 1))
echo "$FAILS" > "$STATE_FILE"

logger -t oak-gotee-watchdog "probe failed (fails=$FAILS) reply=${REPLY:-<empty>}"

case "$FAILS" in
    1)
        # First miss is often transient (forwarder restarting, Armory
        # mid-handshake). Wait one cycle before acting.
        ;;
    2)
        logger -t oak-gotee-watchdog "restarting oak-gotee.service"
        systemctl restart oak-gotee.service 2>/dev/null || true
        ;;
    3)
        logger -t oak-gotee-watchdog "bouncing usb0 and restarting oak-gotee.service"
        ip link set usb0 down 2>/dev/null || true
        sleep 1
        ip link set usb0 up 2>/dev/null || true
        # Re-add the static IP. The `|| true` covers "already exists".
        ip addr add 10.0.0.2/24 dev usb0 2>/dev/null || true
        systemctl restart oak-gotee.service 2>/dev/null || true
        ;;
    *)
        # 4+ consecutive misses suggest the Armory itself is in trouble.
        # Keep poking, but only every other cycle, to avoid log spam
        # and pointless usb0 churn while waiting for human help.
        if [ $((FAILS % 2)) -eq 0 ]; then
            logger -t oak-gotee-watchdog "still down after $FAILS probes; another restart attempt"
            systemctl restart oak-gotee.service 2>/dev/null || true
        fi
        ;;
esac

# Always exit clean so the timer-driven service doesn't accumulate a
# "failed" status. The logger lines above are the source of truth.
exit 0
