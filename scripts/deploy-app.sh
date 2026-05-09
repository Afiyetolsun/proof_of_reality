#!/usr/bin/env bash
# Push a new build of the oakapp to the OAK device.
#
# Idempotent: uninstalls any existing install of this identifier, builds the
# .oakapp from this repo, installs it, applies runtime env via
# `oakctl app config set`, and starts it with autostart-on-boot enabled.
#
# Required env:
#   OAK_PASSWORD              OAK device root password (used by oakctl --password)
#
# Recommended env (omit either to skip the corresponding config update):
#   CAMERA_SHARED_SECRET      pairs with backend's CAMERA_SHARED_SECRET
#   BACKEND_URL               default: https://proof-of-reality-api.vercel.app
#
# Direct-storage env (omit to leave the OAK in api-only mode, in which
# scenes >4MB silently downgrade to local:<sha> and aren't pinned):
#   BEE_URL                   Bee node URL, e.g. http://89.116.31.10:1633
#   SWARM_POSTAGE_BATCH_ID    Bee postage batch ID
#   PINATA_JWT                alternative IPFS path; takes precedence over Bee
#
# Optional env:
#   OAK_DEVICE                oakctl -d argument (default 1 → first listed device)
#   IDENTIFIER                oakapp identifier (default from oakapp.toml)
#
# Example:
#   OAK_PASSWORD=12345678 \
#   CAMERA_SHARED_SECRET=$(cat ~/secrets/oak-camera-key) \
#   BEE_URL=http://89.116.31.10:1633 \
#   SWARM_POSTAGE_BATCH_ID=810e263a9eba821cfebd943cbf1e4885e1983ddc47b93faab7370f516bc44067 \
#   ./scripts/deploy-app.sh
#
# This is the *app* deploy. The *host* deploy (USB Armory forwarder /
# systemd unit) is a separate one-time setup — see scripts/deploy.sh.

set -euo pipefail

: "${OAK_PASSWORD:?env OAK_PASSWORD must be set}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OAK_DEVICE="${OAK_DEVICE:-1}"
BACKEND_URL="${BACKEND_URL:-https://proof-of-reality-api.vercel.app}"
IDENTIFIER="${IDENTIFIER:-$(awk -F\" '/^identifier/ {print $2; exit}' "$REPO_ROOT/oakapp.toml")}"
PKG_DIR="${PKG_DIR:-/tmp/oak-scan-and-sign-pkg}"

OK="oakctl --password $OAK_PASSWORD"

echo "[1/5] uninstall any previous installs of $IDENTIFIER on device $OAK_DEVICE"
APPS=$($OK app list -d "$OAK_DEVICE" --format json \
  | jq -r --arg id "$IDENTIFIER" '.[] | select(.identifier==$id) | .app_id' || true)
for a in $APPS; do
  echo "  uninstalling $a"
  $OK app uninstall "$a" || true
done

echo "[2/5] build .oakapp from $REPO_ROOT"
mkdir -p "$PKG_DIR"
rm -f "$PKG_DIR"/*.oakapp
$OK app build "$REPO_ROOT" --output "$PKG_DIR"

PKG=$(ls "$PKG_DIR"/*.oakapp | head -n1)
echo "  built $PKG"

echo "[3/5] install on device"
$OK app install "$PKG"

APP_ID=$($OK app list -d "$OAK_DEVICE" --format json \
  | jq -r --arg id "$IDENTIFIER" '.[] | select(.identifier==$id) | .app_id' \
  | head -n1)
echo "  APP_ID=$APP_ID"

echo "[4/5] push runtime env"
ENV_ARGS=(--env "BACKEND_URL=$BACKEND_URL")
if [ -n "${CAMERA_SHARED_SECRET:-}" ]; then
  ENV_ARGS+=(--env "CAMERA_SHARED_SECRET=$CAMERA_SHARED_SECRET")
fi
# Direct-storage credentials. With these set, scenes >4MB upload
# straight to Bee/Pinata and get a real swarmRef instead of a
# local:<sha> placeholder. Each is independent — push only what's set,
# so a fresh BEE_URL deploy doesn't accidentally clear an existing
# CAMERA_SHARED_SECRET (oakctl app config set is incremental — keys not
# passed are left untouched).
if [ -n "${BEE_URL:-}" ]; then
  ENV_ARGS+=(--env "BEE_URL=$BEE_URL")
fi
if [ -n "${SWARM_POSTAGE_BATCH_ID:-}" ]; then
  ENV_ARGS+=(--env "SWARM_POSTAGE_BATCH_ID=$SWARM_POSTAGE_BATCH_ID")
fi
if [ -n "${PINATA_JWT:-}" ]; then
  ENV_ARGS+=(--env "PINATA_JWT=$PINATA_JWT")
fi
$OK app config set "$APP_ID" "${ENV_ARGS[@]}"

echo "[5/5] start with autostart-on-boot"
# Fresh installs aren't running yet, so `app start --enable` is the right call.
# If a previous run left it Running, oakctl errors out — fall back to
# `app restart` so the new env actually takes effect.
$OK app start "$APP_ID" --enable --disable-others 2>/dev/null \
  || $OK app restart "$APP_ID"

# Pull the device IP for the post-deploy hint. Falls back to a placeholder
# if the device-info JSON shape changes.
OAK_IP=$($OK device info -d "$OAK_DEVICE" --format json 2>/dev/null \
  | jq -r '.network_config.interfaces[0].addr[]?.V4.ip.octets | join(".")' 2>/dev/null \
  | head -n1) || true
OAK_IP=${OAK_IP:-<oak-ip>}

echo
echo "[ok] deployed $IDENTIFIER"
echo "    APP_ID:  $APP_ID"
echo "    panel:   http://$OAK_IP:8080/"
echo "    health:  curl -s http://$OAK_IP:8080/healthz | jq"
echo "    logs:    oakctl --password \$OAK_PASSWORD app logs $APP_ID --tail 80"
echo "    reboot:  oakctl --password \$OAK_PASSWORD device reboot -d $OAK_DEVICE"
