#!/usr/bin/env bash
# Deploy proof-of-reality-agent to a Luxonis OAK 4 D over SSH.
#
# Assumes the camera has Luxonis OS, Python 3.11+, and is reachable as oak4d.local.
#
# Usage: ./install.sh <camera-host>

set -euo pipefail
HOST=${1:-oak4d.local}

echo "[deploy] copying agent to $HOST…"
rsync -av --exclude='__pycache__' --exclude='.venv' \
  ../src/ "$HOST:/opt/proof-agent/src/"
rsync -av ../pyproject.toml "$HOST:/opt/proof-agent/"
rsync -av deploy/systemd/proof-agent.service "$HOST:/etc/systemd/system/"

echo "[deploy] installing deps + enabling service on $HOST…"
ssh "$HOST" 'cd /opt/proof-agent && pip install -e . && systemctl daemon-reload && systemctl enable --now proof-agent'

echo "[deploy] done. Logs: ssh $HOST journalctl -u proof-agent -f"
