#!/usr/bin/env bash
# Convenience: scp the host-side forwarder + setup script to the OAK,
# then run the setup. Run from the repo root on your laptop.
#
#   OAK_IP=192.168.88.236 scripts/deploy.sh
#
# Requires SSH key access (or you'll be prompted for the OAK root password).

set -euo pipefail
OAK_IP="${OAK_IP:-192.168.88.236}"
HERE="$(cd "$(dirname "$0")" && pwd)"

echo "→ copying host scripts to ${OAK_IP}:/tmp/"
scp "$HERE/forwarder.py" "$HERE/oak-host-setup.sh" "root@${OAK_IP}:/tmp/"

echo "→ running host setup on ${OAK_IP}"
ssh "root@${OAK_IP}" 'sh /tmp/oak-host-setup.sh'

echo
echo "Now: from this directory run"
echo "  oakctl app run ."
echo "and open http://${OAK_IP}:8080"
