#!/usr/bin/env bash
# Helper for the Bee node lifecycle. Talks to the API at $BEE_API.
#
#   ./bee-setup.sh status    →  health, peers, wallet address, balances
#   ./bee-setup.sh stamp     →  buy a postage batch (needs xBZZ + xDAI)
#   ./bee-setup.sh stamps    →  list existing batches
#   ./bee-setup.sh upload F  →  upload file F, print swarm reference
#
# Stamp size + duration are configurable via env:
#   STAMP_DEPTH  default 20  (depth 20 ≈ 4 GB capacity)
#   STAMP_AMOUNT default 414720000  (≈ 24 days at current pricing)

set -euo pipefail

BEE_API="${BEE_API:-http://localhost:1633}"
STAMP_DEPTH="${STAMP_DEPTH:-20}"
STAMP_AMOUNT="${STAMP_AMOUNT:-414720000}"

cmd="${1:-status}"

case "$cmd" in
  status)
    echo "===== Bee node status ====="
    health=$(curl -fsS "$BEE_API/health" || echo "{}")
    echo "  health:  $health"

    addr=$(curl -fsS "$BEE_API/addresses" 2>/dev/null || echo "{}")
    eth=$(echo "$addr" | grep -o '"ethereum":"[^"]*"' | cut -d'"' -f4 || true)
    echo "  wallet:  ${eth:-<not ready yet, give the node a few seconds>}"

    peers=$(curl -fsS "$BEE_API/peers" 2>/dev/null | grep -oc '"address"' || echo 0)
    echo "  peers:   $peers"

    if [[ -n "${eth:-}" ]]; then
      cb=$(curl -fsS "$BEE_API/chequebook/balance" 2>/dev/null || echo "{}")
      bzz=$(echo "$cb" | grep -o '"availableBalance":"[^"]*"' | cut -d'"' -f4 || echo 0)
      bal=$(curl -fsS "$BEE_API/wallet" 2>/dev/null || echo "{}")
      xdai=$(echo "$bal" | grep -o '"nativeTokenBalance":"[^"]*"' | cut -d'"' -f4 || echo 0)
      bzzraw=$(echo "$bal" | grep -o '"bzzBalance":"[^"]*"' | cut -d'"' -f4 || echo 0)
      echo "  xDAI:    $xdai (raw wei)"
      echo "  xBZZ:    $bzzraw (raw, 16 decimals)"
      echo "  cheque:  $bzz (raw, available)"
      echo
      echo "Fund this address on Gnosis Chain (chainID 100):"
      echo "  $eth"
      echo "  → ~0.05 xDAI for gas"
      echo "  → ~0.5 xBZZ for the stamp"
    fi
    ;;

  stamp)
    echo "Buying postage batch: depth=$STAMP_DEPTH amount=$STAMP_AMOUNT"
    echo "(this submits a tx on Gnosis Chain — takes ~10s)"
    out=$(curl -fsS -X POST "$BEE_API/stamps/$STAMP_AMOUNT/$STAMP_DEPTH")
    echo "$out"
    bid=$(echo "$out" | grep -o '"batchID":"[^"]*"' | cut -d'"' -f4)
    if [[ -n "$bid" ]]; then
      echo
      echo "✅ batch ID: $bid"
      echo
      echo "Now in apps/api/.env (and Vercel env):"
      echo "  STORAGE_BACKEND=swarm"
      echo "  SWARM_BEE_URL=http://localhost:1633   # or http://<vps-ip>:1633 in prod"
      echo "  SWARM_POSTAGE_BATCH_ID=$bid"
    fi
    ;;

  stamps)
    curl -fsS "$BEE_API/stamps" | sed 's/,/,\n/g'
    ;;

  upload)
    file="${2:?usage: ./bee-setup.sh upload <file>}"
    bid="${SWARM_POSTAGE_BATCH_ID:?set SWARM_POSTAGE_BATCH_ID first}"
    echo "Uploading $file (batch=$bid)"
    out=$(curl -fsS -X POST \
      -H "Content-Type: application/octet-stream" \
      -H "Swarm-Postage-Batch-Id: $bid" \
      --data-binary "@$file" \
      "$BEE_API/bzz")
    echo "$out"
    ref=$(echo "$out" | grep -o '"reference":"[^"]*"' | cut -d'"' -f4)
    if [[ -n "$ref" ]]; then
      echo
      echo "✅ reference: $ref"
      echo "  fetch:  curl $BEE_API/bzz/$ref -o /tmp/$file.fetched"
      echo "  public: https://gateway.ethswarm.org/bzz/$ref"
    fi
    ;;

  *)
    echo "usage: $0 {status|stamp|stamps|upload <file>}"
    exit 1
    ;;
esac
