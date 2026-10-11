#!/bin/sh
set -eu
# Run as root on the board so rknn-smi can read device telemetry.
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
NODE=${NODE_BIN:-$ROOT/runtime/node-v22.23.3-linux-arm64/bin/node}
test -x "$NODE"
systemd-run --unit=rk1828-vlm-soak-4h \
  --working-directory="$ROOT" \
  --property=TimeoutStopSec=180 \
  --property="StandardOutput=append:$ROOT/results/board-soak-service.log" \
  --property="StandardError=append:$ROOT/results/board-soak-service.log" \
  --setenv=RKNN3_NETWORK_SOCKET_FILE=/tmp/rk-mdns.ini \
  "$NODE" "$ROOT/scripts/board-soak.mjs" 14400
