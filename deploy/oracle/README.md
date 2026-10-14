# Oracle Cloud with Docker

Use a dedicated Ubuntu 24.04 ARM64 VM. A starting allocation is 2 OCPUs, 8 GB RAM,
and a 50 GB boot volume. Check the account's remaining free allowance before creating
it: compute and storage allocations are shared with existing projects. Oracle's
[current Always Free documentation](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
lists 2 OCPUs / 12 GB for A1 and 200 GB combined boot/block storage. Availability is
not guaranteed; idle instances may be reclaimed.

The Docker image installs only Chromium, using the lockfile's exact Playwright
version, and works on ARM64 and AMD64. It uses that browser instead of requiring system Chrome.
Xvfb provides a screen while keeping `headless: false`. The application runs as a
non-root user. A container has a 4 GB memory limit, 1.5 CPU limit, 1 GB shared memory,
and no published port except during interactive login. These are starting limits;
measure a real application run before reducing memory.

If Oracle reports `OUT_OF_HOST_CAPACITY`, retain the existing projects and retry
creation later. A different paid shape or a non-home region is not a free-tier
substitute. There is no need to run a busy retry loop.

## Install on the VM

Run as the normal `ubuntu` user:

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Log out and SSH back in so Docker group membership takes effect, then:

```bash
git clone https://github.com/tejas261/naukri_update.git
cd naukri_update
# Until merged, check out the deployment branch:
git switch feat/oracle-deployment
install -d -m 700 data
install -m 600 .env.example .env
nano .env
docker compose -f deploy/oracle/compose.yaml build
```

Fill in your own identity, experience, salary, and application answers. Set
`RESUME_FILE=/data/resume.pdf`, then copy your resume to `data/resume.pdf` and run
`chmod 600 data/resume.pdf`. Keep `.env`, the resume, and the entire `data/` directory
out of Git. Do not copy the example applicant details into live applications.
Optional Gemini usage has separate billing and is disabled when its key is empty.

You can leave `GOOGLE_PASSWORD` empty if you use the interactive login below. An
expired refresh session will then require another interactive login instead of
automatic password login. The existing `check-setup.js` still reports missing
Google credentials in that configuration.

The `.env` file is mounted read-only into the container. Browser profiles, counters,
CSV history, screenshots, and refresh logs are written to `data/` on the VM, so
rebuilding/removing containers does not remove sessions. Desktop installs continue
using their original paths and installed Chrome unless these runtime environment
variables are explicitly set:

| Variable | Default | Container |
| --- | --- | --- |
| `DATA_DIR` | Repository directory | `/data` |
| `BROWSER_CHANNEL` | `chrome` | `bundled` |
| `BROWSER_EXECUTABLE_PATH` | Unset | Optional explicit browser override |
| `TZ` | System default | `Asia/Kolkata` |

These runtime settings are process environment variables; the compose file sets
them independently of the application's `.env` parser.

## Verify the container without touching job sites

```bash
./deploy/oracle/run.sh smoke
```

This launches a headed browser against a local test page, saves localStorage,
reopens the profile, and verifies persistence. It reports the browser architecture
and container peak memory. This small test is not a measurement of job-site memory.

## Log in privately

On your laptop, keep an SSH tunnel open (replace `VM_IP`):

```bash
ssh -i ~/.ssh/naukri_oracle -L 5901:127.0.0.1:5901 ubuntu@VM_IP
```

In that VM shell:

```bash
cd ~/naukri_update
./deploy/oracle/run.sh login refresh
```

Open `vnc://127.0.0.1:5901` in your laptop's VNC client (macOS Screen Sharing works).
The desktop is reachable only through the SSH tunnel. There is no separate VNC
password because the listener is bound to the VM's loopback interface; do not
change the published address to `0.0.0.0` or open a cloud VNC port.

Log in, complete any MFA/CAPTCHA yourself, then close the browser window. Repeat
for `login naukri`, `login wellfound`, and `login indeed` as needed. Naukri refresh
and Naukri apply deliberately use separate browser profiles. The login helper does
not update a profile or send an application.

Cloud IPs and bundled browsers can receive additional login challenges. Validate
the actual site sessions on the VM; successful container startup does not prove
that those sites will accept unattended runs.

## Configure and schedule

Review the search URLs and application filters in `auto-apply-runner.js` and the
site scripts: the upstream defaults target full-stack/developer roles and include
experience-specific searches. Rebuild after changing source files.

```bash
./deploy/oracle/run.sh check --quick
./deploy/oracle/run.sh naukri       # dry run unless data/live-enabled exists
./deploy/oracle/run.sh wellfound
./deploy/oracle/run.sh indeed
./deploy/oracle/install-timers.sh   # installs units, leaves all timers disabled
```

The wrapper serializes every browser task, including login, with one host `flock`.
If another task is active, a scheduled invocation exits with code 75 (treated as a
successful skip by systemd). This avoids simultaneous browsers, shared CSV writes,
and daily-count races. Consequently an hourly refresh can be skipped during a long
application run. A timed-out service stops its named Docker container as well.

Default timer schedules are in **Asia/Kolkata** with up to two minutes of jitter:

| Timer | Schedule |
| --- | --- |
| `naukri-refresh.timer` | Hourly at minute 17 |
| `naukri-naukri.timer` | Daily at 09:30 |
| `naukri-wellfound.timer` | Daily at 12:00 |
| `naukri-indeed.timer` | Daily at 15:00 |

Missed runs during downtime are not replayed. Each service has a 130-minute outer
timeout; the application runner retains its existing 100-minute internal budget.
Installing timers does not enable them. After configuration and dry-run review,
enable only the desired timers:

```bash
# Refresh changes the real Naukri profile; it has no dry-run mode.
sudo systemctl enable --now naukri-refresh.timer

# These remain application dry runs until you explicitly enable live mode.
sudo systemctl enable --now naukri-naukri.timer naukri-wellfound.timer naukri-indeed.timer
```

To enable real application submissions after reviewing results:

```bash
touch data/live-enabled
```

Remove that file to return future application runs to dry-run mode. Changing it
does not change a run already in progress; stop the relevant service first if needed.

## Operate, update, and back up

```bash
systemctl list-timers 'naukri-*'
journalctl -u naukri-job@naukri.service -n 100
docker stats naukri-automation-job

# Stop scheduled work, including anything already running:
sudo systemctl disable --now naukri-refresh.timer naukri-naukri.timer naukri-wellfound.timer naukri-indeed.timer
sudo systemctl stop naukri-job@refresh.service naukri-job@naukri.service naukri-job@wellfound.service naukri-job@indeed.service

# Update source and rebuild, preserving .env and data/:
git pull --ff-only
docker compose -f deploy/oracle/compose.yaml build
./deploy/oracle/run.sh smoke
```

Back up `.env` and `data/` privately while browser jobs are stopped. The profile
directories contain authenticated sessions. Exclude caches if backup size grows,
but keep cookies and site storage. Periodically archive application history and
refresh logs. Rebuilding after a Playwright lockfile update automatically installs
the browser revision matching the new version.

For an unattended run that exits unsuccessfully, inspect `journalctl` and the
screenshots under `data/`. If sessions expire, stop the application timers and use
the interactive login helper again. Do not run multiple containers against the
same profile directory outside the locking wrapper.
