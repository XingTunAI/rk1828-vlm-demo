#!/bin/sh
# Run from the logged-in board desktop. Does not change login or GPU drivers.
set -eu
APP_DIR=${1:-/userdata/rk1828-vlm-demo}
BROWSER=/usr/lib/aarch64-linux-gnu/webkit2gtk-4.0/MiniBrowser
export LD_LIBRARY_PATH="$APP_DIR/runtime/browser-libs/usr/lib/aarch64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export WEBKIT_DISABLE_COMPOSITING_MODE=1
export LIBGL_ALWAYS_SOFTWARE=1
exec "$BROWSER" "http://127.0.0.1:8787/?baseUrl=http%3A%2F%2F127.0.0.1%3A8080%2Fv1"
