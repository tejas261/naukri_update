#!/usr/bin/env bash
set -euo pipefail
task_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$task_root"
umask 077
mkdir -p data
export RUNNER_UID=$(id -u) RUNNER_GID=$(id -g)

task=${1:-smoke}
shift || true
compose_args=(run --rm --name naukri-automation-job -T)
case "$task" in
  smoke) command=(node deploy/oracle/smoke.js) ;;
  check) command=(node check-setup.js "$@") ;;
  login)
    case "${1:-}" in refresh|naukri|wellfound|indeed) ;; *) echo 'Choose a login target: refresh, naukri, wellfound, indeed.' >&2; exit 2;; esac
    compose_args+=(--service-ports -e ENABLE_VNC=true)
    command=(node deploy/oracle/login.js "$1") ;;
  refresh) command=(node naukri-profile-refresh.js --show) ;;
  naukri|wellfound|indeed)
    command=(node auto-apply-runner.js "$task" --show)
    if [[ -f data/live-enabled ]]; then command+=(--live); fi ;;
  *) echo 'Usage: run.sh {smoke|check|login TARGET|refresh|naukri|wellfound|indeed}' >&2; exit 2 ;;
esac

# A single lock also prevents CSV/state races and keeps peak browser memory bounded.
exec 9>data/.runner.lock
if ! flock -n 9; then echo 'Another browser job is active; skipping.'; exit 75; fi
if [[ ! -f .env ]]; then echo 'Create .env from .env.example before running.' >&2; exit 1; fi

cleanup() {
  docker stop --time 35 naukri-automation-job >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
docker compose -f deploy/oracle/compose.yaml "${compose_args[@]}" runner "${command[@]}" &
compose_pid=$!
wait "$compose_pid"
