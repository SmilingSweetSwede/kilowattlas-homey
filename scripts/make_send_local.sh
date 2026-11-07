#!/usr/bin/env bash
#
# Write homeyscript/send.dev.local.js: send.js pointed at a development
# backend, ready to paste into HomeyScript as one file. It holds no secret
# (the script links itself with a device code), but it is gitignored like
# every *.local.js. An existing send.local.js is never touched.
#
# Usage:  ./scripts/make_send_local.sh [api_base] [--fast]
#   api_base defaults to http://backend:8050 (the dev backend as seen from the
#   homey-shs container on the compose network).
#   --fast: one batch per second for 55 s per run (for a Flow that triggers
#   every minute) instead of one batch per run.
#
# Approve the code the script prints on the dev stack's /link page.

set -euo pipefail
cd "$(dirname "$0")/.."

API_BASE="http://backend:8050"
FAST=0
for arg in "$@"; do
  case "$arg" in
    --fast) FAST=1 ;;
    kwc_*) echo "no token needed any more: the script links itself" >&2; exit 1 ;;
    *) API_BASE="$arg" ;;
  esac
done

OUT=homeyscript/send.dev.local.js
API_BASE="$API_BASE" FAST="$FAST" OUT="$OUT" python3 - <<'PY'
import os, pathlib
src = pathlib.Path("homeyscript/send.js").read_text()
def sub(old, new):
    global src
    assert old in src, f"not found in send.js: {old}"
    src = src.replace(old, new, 1)
sub("const API_BASE = 'https://api.kilowattlas.com';", f"const API_BASE = '{os.environ['API_BASE']}';")
if os.environ["FAST"] == "1":
    sub("const INTERVAL_SECONDS = 60;", "const INTERVAL_SECONDS = 1;")
    sub("const RUN_SECONDS = 0;", "const RUN_SECONDS = 55;")
pathlib.Path(os.environ["OUT"]).write_text(src)
PY

echo "written: $PWD/$OUT (API $API_BASE, $([ "$FAST" = 1 ] && echo "1 batch/s for 55 s per run" || echo "1 batch per run"))"
if command -v xclip >/dev/null 2>&1 && xclip -selection clipboard < "$OUT" 2>/dev/null; then
  echo "copied to the clipboard: paste it into a new HomeyScript named 'kilowattlas'"
elif command -v wl-copy >/dev/null 2>&1 && wl-copy < "$OUT" 2>/dev/null; then
  echo "copied to the clipboard: paste it into a new HomeyScript named 'kilowattlas'"
else
  echo "open it in VS Code, select all, copy, paste into a new HomeyScript named 'kilowattlas'"
fi
