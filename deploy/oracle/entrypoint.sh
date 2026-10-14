#!/usr/bin/env bash
set -euo pipefail
umask 077

child_pid=''
cleanup() {
  if [[ -n "$child_pid" ]]; then kill -TERM "$child_pid" 2>/dev/null || true; fi
  jobs -pr | xargs -r kill -TERM 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

Xvfb "$DISPLAY" -screen 0 1280x900x24 -nolisten tcp &
for attempt in {1..50}; do
  if xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then break; fi
  sleep 0.1
done
xdpyinfo -display "$DISPLAY" >/dev/null

if [[ "${ENABLE_VNC:-false}" == true ]]; then
  fluxbox >/tmp/fluxbox.log 2>&1 &
  # No public port: compose binds it to host loopback, accessed only over SSH.
  x11vnc -display "$DISPLAY" -rfbport 5900 -forever -shared -nopw \
    -quiet >/tmp/x11vnc.log 2>&1 &
fi

"$@" &
child_pid=$!
wait "$child_pid"
