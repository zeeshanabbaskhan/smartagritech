#!/usr/bin/env bash
# Run on the Linux server after a tarball is uploaded.
# Usage: remote-up.sh <backend|frontend> <tarball-path> <deploy-path>
set -euo pipefail

SERVICE="${1:?Usage: remote-up.sh <backend|frontend> <tarball> <deploy-path>}"
TARBALL="${2:?}"
DEPLOY_PATH="${3:?}"

case "$SERVICE" in
  backend|frontend) ;;
  *)
    echo "Service must be backend or frontend, got: $SERVICE"
    exit 1
    ;;
esac

if [ ! -f "$TARBALL" ]; then
  echo "Tarball not found: $TARBALL"
  exit 1
fi

if [ ! -f "${DEPLOY_PATH}/docker-compose.yml" ]; then
  echo "Missing ${DEPLOY_PATH}/docker-compose.yml — copy deploy/docker-compose.yml to the server first"
  exit 1
fi

if [ ! -f "${DEPLOY_PATH}/.env" ]; then
  echo "Missing ${DEPLOY_PATH}/.env — copy deploy/linux.env.example and fill secrets first"
  exit 1
fi

TARGET="${DEPLOY_PATH}/${SERVICE}"
mkdir -p "$TARGET"
# Clear previous source (keep nothing that could stale the Docker build context)
find "$TARGET" -mindepth 1 -maxdepth 1 -exec rm -rf {} +

# Extract into a user-owned temp dir first. Archives pack "." which makes tar try to
# chmod/utime the extract root — that fails when TARGET is not owned by the SSH user.
STAGE="$(mktemp -d /tmp/ems-extract-XXXXXX)"
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT
tar -xzf "$TARBALL" -C "$STAGE" --no-same-owner --no-same-permissions
# Move contents (including hidden files) into TARGET
shopt -s dotglob nullglob
mv "$STAGE"/* "$TARGET"/
shopt -u dotglob nullglob
rm -f "$TARBALL"

cd "$DEPLOY_PATH"

# Keep enough free space for docker layer export (CI fails with "no space left on device")
echo "Disk before prune:"
df -h / | tail -1 || true
docker builder prune -af >/dev/null 2>&1 || true
docker image prune -af >/dev/null 2>&1 || true
# Old CapRover / dangling leftovers are safe to drop if unused
docker container prune -f >/dev/null 2>&1 || true
rm -f /tmp/ems-backend-*.tgz /tmp/ems-frontend-*.tgz /tmp/ems-remote-up.sh 2>/dev/null || true
# MQTT bridge debug log can grow to multi-GB and starve deploys
if [ -f /opt/mqtt/mqtt_to_http.log ]; then
  truncate -s 0 /opt/mqtt/mqtt_to_http.log 2>/dev/null || true
fi
echo "Disk after prune:"
df -h / | tail -1 || true

docker compose up -d --build --remove-orphans "$SERVICE"

echo "Deployed ${SERVICE} from ${TARGET}"
