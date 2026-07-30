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
tar -xzf "$TARBALL" -C "$TARGET"
rm -f "$TARBALL"

cd "$DEPLOY_PATH"
docker compose up -d --build --remove-orphans "$SERVICE"

echo "Deployed ${SERVICE} from ${TARGET}"
