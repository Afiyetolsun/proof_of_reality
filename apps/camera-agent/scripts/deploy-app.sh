#!/usr/bin/env bash
# Push a new build of the oakapp to the OAK device.
#
# Idempotent: snapshots the previous app's runtime env, uninstalls the
# old install, builds the .oakapp from this repo, installs it, restores
# the snapshotted env (with any explicitly-exported vars overriding),
# and starts it with autostart-on-boot enabled.
#
# The snapshot+restore is what keeps env durable across redeploys:
# `oakctl app uninstall` wipes the config, and `oakctl app config set`
# *replaces* the env unless --extend is passed (and even with --extend,
# there is nothing to extend from after an uninstall). So redeploying
# with only some of the vars exported in your shell would silently drop
# the others. Capturing first means a deploy with just BACKEND_URL set
# preserves an already-installed CAMERA_SHARED_SECRET / BEE_URL / etc.
#
# Required env:
#   OAK_PASSWORD              OAK device root password (used by oakctl --password)
#
# Recommended env (omit either to skip the corresponding config update):
#   CAMERA_SHARED_SECRET      pairs with backend's CAMERA_SHARED_SECRET
#   BACKEND_URL               default: https://api.realityproof.app
#
# Direct-storage env (omit to leave the OAK in api-only mode, in which
# scenes >4MB silently downgrade to local:<sha> and aren't pinned):
#   SWARM_BEE_URL (or BEE_URL)  Bee node URL, e.g. http://89.116.31.10:1633.
#                               SWARM_BEE_URL is the backend-canonical name;
#                               BEE_URL is accepted as an alias.
#   SWARM_POSTAGE_BATCH_ID      Bee postage batch ID
#   PINATA_JWT                  alternative IPFS path; takes precedence over Bee
#
# Tip: keep these in a gitignored `.env` at the repo root and source
# it before running this script (`set -a; source .env; set +a`) so you
# don't have to re-type long secrets each shell session.
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
BACKEND_URL="${BACKEND_URL:-https://api.realityproof.app}"
IDENTIFIER="${IDENTIFIER:-$(awk -F\" '/^identifier/ {print $2; exit}' "$REPO_ROOT/oakapp.toml")}"
PKG_DIR="${PKG_DIR:-/tmp/oak-scan-and-sign-pkg}"

OK="oakctl --password $OAK_PASSWORD"

PREV_ENV_FILE=$(mktemp)
NEW_ENV_FILE=$(mktemp)
trap 'rm -f "$PREV_ENV_FILE" "$NEW_ENV_FILE"' EXIT

echo "[1/5] snapshot existing env + uninstall any previous installs of $IDENTIFIER"
APPS=$($OK app list -d "$OAK_DEVICE" --format json \
  | jq -r --arg id "$IDENTIFIER" '.[] | select(.identifier==$id) | .app_id' || true)
# Snapshot the first match's env before nuking it. The JSON shape of
# `app config get` isn't documented, so handle the two plausible
# layouts: {"env": {K: V}} (most likely) or {K: V} directly. jq's `?`
# swallows mismatches so an unexpected shape just yields an empty file
# and the deploy continues with only the explicitly-exported vars.
for prev in $APPS; do
  $OK app config get "$prev" --format json 2>/dev/null \
    | jq -r '
        (if type == "object" and has("env") and (.env|type) == "object" then .env
         elif type == "object" then .
         else {} end)
        | to_entries[]?
        | "\(.key)=\(.value)"
      ' > "$PREV_ENV_FILE" 2>/dev/null || true
  echo "  snapshotted $(wc -l < "$PREV_ENV_FILE" | tr -d ' ') env var(s) from $prev"
  break
done
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

echo "[4/5] push runtime env (snapshot + overrides)"
# Build the merged env file: snapshotted vars first, then any
# explicitly-exported overrides. We deduplicate at the end keeping the
# *last* occurrence per key, so anything you re-export this run wins
# over the snapshot, and anything you don't re-export is preserved.
cat "$PREV_ENV_FILE" > "$NEW_ENV_FILE"
echo "BACKEND_URL=$BACKEND_URL" >> "$NEW_ENV_FILE"
[ -n "${CAMERA_SHARED_SECRET:-}" ]   && echo "CAMERA_SHARED_SECRET=$CAMERA_SHARED_SECRET"   >> "$NEW_ENV_FILE"
# SWARM_BEE_URL is the backend-canonical name (matches env.ts). BEE_URL
# is accepted as an alias for back-compat with earlier deploys; main.py
# reads SWARM_BEE_URL as a fallback when BEE_URL isn't set, so pushing
# either name reaches the OAK app.
[ -n "${SWARM_BEE_URL:-}" ]          && echo "SWARM_BEE_URL=$SWARM_BEE_URL"                >> "$NEW_ENV_FILE"
[ -n "${BEE_URL:-}" ]                && echo "BEE_URL=$BEE_URL"                            >> "$NEW_ENV_FILE"
[ -n "${SWARM_POSTAGE_BATCH_ID:-}" ] && echo "SWARM_POSTAGE_BATCH_ID=$SWARM_POSTAGE_BATCH_ID" >> "$NEW_ENV_FILE"
[ -n "${PINATA_JWT:-}" ]             && echo "PINATA_JWT=$PINATA_JWT"                      >> "$NEW_ENV_FILE"

# Last-occurrence-wins dedup. awk reads the file twice: pass 1 records
# the final line number for each key; pass 2 emits only that line. Order
# in env files doesn't matter, but preserving last-set semantics does.
DEDUP_FILE=$(mktemp)
trap 'rm -f "$PREV_ENV_FILE" "$NEW_ENV_FILE" "$DEDUP_FILE"' EXIT
awk -F= '
  NR==FNR { last[$1]=NR; next }
  last[$1]==FNR
' "$NEW_ENV_FILE" "$NEW_ENV_FILE" > "$DEDUP_FILE"

echo "  pushing $(wc -l < "$DEDUP_FILE" | tr -d ' ') env var(s)"
$OK app config set "$APP_ID" --env-file "$DEDUP_FILE"

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
