#!/usr/bin/env bash
#
# Server-side half of the dashboard deploy. Run on the server by
# .github/workflows/deploy.yml after a release has been rsynced to
# $RELEASES_DIR/<sha>/ -- or by hand, to roll forward or back to any release
# directory that is still present:
#
#   bash /opt/codeora/dashboard-releases/<sha>/deploy-dashboard.sh <sha>
#
# What it does, in order:
#   1. Points <release>/.env.local at the real env file, which lives outside
#      every release and is never in git. Next's standalone server.js reads
#      .env.local from its own directory, so the link has to be inside the
#      release.
#   2. Repoints the `current` symlink atomically (write a temp link, rename
#      over the old one) so there is never a moment with no release.
#   3. Restarts the systemd unit and waits for /login to answer 200.
#   4. On failure: repoints `current` back to the previous release, restarts
#      again, prints the last 40 journal lines and exits non-zero.
#   5. On success: deletes all but the 3 newest releases.
#
# Needs: passwordless sudo for `systemctl restart codeora-dashboard` and
# `journalctl -u codeora-dashboard` (see DEPLOY.md), curl, GNU coreutils.
set -euo pipefail

SHA="${1:?usage: deploy-dashboard.sh <git sha>}"
RELEASES_DIR="${RELEASES_DIR:-/opt/codeora/dashboard-releases}"
ENV_FILE="${ENV_FILE:-/opt/codeora/dashboard/.env.local}"
SERVICE="${SERVICE:-codeora-dashboard}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/login}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-30}"
KEEP_RELEASES="${KEEP_RELEASES:-3}"

RELEASE="$RELEASES_DIR/$SHA"
CURRENT="$RELEASES_DIR/current"

log() { printf '[deploy %s] %s\n' "$(date +%H:%M:%S)" "$*"; }

[ -f "$RELEASE/server.js" ] || { log "no release at $RELEASE (server.js missing)"; exit 1; }
[ -f "$ENV_FILE" ] || { log "env file $ENV_FILE is missing -- the app cannot start without it"; exit 1; }

# 1. Env: a link inside the release to the one real file.
ln -sfn "$ENV_FILE" "$RELEASE/.env.local"

# Remember where we came from, for the rollback.
PREVIOUS=""
if [ -L "$CURRENT" ]; then
  PREVIOUS="$(readlink -f "$CURRENT" || true)"
fi
if [ -n "$PREVIOUS" ] && [ "$PREVIOUS" = "$(readlink -f "$RELEASE")" ]; then
  log "$SHA is already current; restarting it anyway"
  PREVIOUS=""
fi

# 2. Atomic switch: ln to a temp name, then rename over `current`. rename(2)
# replaces the old link in one step, so a reader never sees it missing.
switch_to() {
  local target="$1"
  ln -sfn "$target" "$CURRENT.tmp.$$"
  mv -T "$CURRENT.tmp.$$" "$CURRENT"
}

# 3. Restart and wait for the app to answer.
restart_and_check() {
  sudo systemctl restart "$SERVICE"
  local waited=0 code=""
  while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$HEALTH_URL" || true)"
    if [ "$code" = "200" ]; then
      log "healthy after ${waited}s (HTTP 200 from $HEALTH_URL)"
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  log "not healthy after ${HEALTH_TIMEOUT}s (last HTTP status: ${code:-none})"
  return 1
}

log "switching current -> $SHA"
switch_to "$RELEASE"

if restart_and_check; then
  # 5. Prune: keep the newest $KEEP_RELEASES release directories (40-hex
  # names only, newest by mtime first). `current` is a link, not a match, and
  # the release just activated is the newest, so it is always kept.
  log "pruning releases older than the newest $KEEP_RELEASES"
  find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -regextype posix-extended -regex '.*/[0-9a-f]{40}$' \
    -printf '%T@ %p\n' | sort -rn | awk -v keep="$KEEP_RELEASES" 'NR > keep { print $2 }' |
    while IFS= read -r old; do
      [ "$(readlink -f "$old")" = "$(readlink -f "$RELEASE")" ] && continue
      log "removing $old"
      rm -rf -- "$old"
    done
  log "deployed $SHA"
  exit 0
fi

# 4. Rollback.
log "---- last 40 journal lines for $SERVICE ----"
sudo journalctl -u "$SERVICE" -n 40 --no-pager || true
log "---------------------------------------------"

if [ -z "$PREVIOUS" ] || [ ! -f "$PREVIOUS/server.js" ]; then
  log "no previous release to roll back to; $CURRENT still points at the failed release $SHA"
  exit 1
fi

log "rolling back current -> $(basename "$PREVIOUS")"
switch_to "$PREVIOUS"
if restart_and_check; then
  log "rolled back to $(basename "$PREVIOUS"); the failed release is left at $RELEASE for inspection"
else
  log "ROLLBACK ALSO UNHEALTHY -- the service needs attention now"
  sudo journalctl -u "$SERVICE" -n 40 --no-pager || true
fi
exit 1
