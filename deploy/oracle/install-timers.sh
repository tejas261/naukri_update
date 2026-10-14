#!/usr/bin/env bash
set -euo pipefail
task_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
task_user=$(id -un)
if [[ $EUID -eq 0 ]]; then echo 'Run as the deployment user; sudo is used only for installing units.' >&2; exit 1; fi
if [[ "$task_root" == *[[:space:]%\"]* ]]; then echo 'Use a checkout path without whitespace, quotes, or percent signs.' >&2; exit 1; fi
command -v flock >/dev/null
docker compose version >/dev/null
mkdir -p "$task_root/data"
chmod 700 "$task_root/data"

task_units=$(mktemp -d)
trap 'rm -rf "$task_units"' EXIT
cat >"$task_units/naukri-job@.service" <<EOF
[Unit]
Description=Naukri automation (%i)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=$task_user
WorkingDirectory=$task_root
Environment=TZ=Asia/Kolkata
UMask=0077
ExecStart=$task_root/deploy/oracle/run.sh %i
TimeoutStartSec=130min
TimeoutStopSec=60s
KillMode=control-group
SuccessExitStatus=75
EOF

# Hourly refresh; staggered, sequential application runs. Timers remain disabled.
for task in refresh naukri wellfound indeed; do
  case "$task" in
    refresh) calendar='*-*-* *:17:00 Asia/Kolkata' ;;
    naukri) calendar='*-*-* 09:30:00 Asia/Kolkata' ;;
    wellfound) calendar='*-*-* 12:00:00 Asia/Kolkata' ;;
    indeed) calendar='*-*-* 15:00:00 Asia/Kolkata' ;;
  esac
  cat >"$task_units/naukri-$task.timer" <<EOF
[Unit]
Description=Schedule $task automation

[Timer]
OnCalendar=$calendar
RandomizedDelaySec=120
Persistent=false
Unit=naukri-job@$task.service

[Install]
WantedBy=timers.target
EOF
done
sudo install -m 644 "$task_units/"* /etc/systemd/system/
sudo systemctl daemon-reload
echo 'Timers installed but disabled. Complete configuration, login, and dry runs before enabling them.'
