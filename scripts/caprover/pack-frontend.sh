#!/usr/bin/env bash
# Pack frontend tarball for CapRover (run from repo root).
# Usage: ./scripts/caprover/pack-frontend.sh iotbackend.yourdomain.com
#   Hostname only — no https://, no /api suffix
set -euo pipefail

RAW_HOST="${1:?Usage: pack-frontend.sh <api-host e.g. iotbackend.yourdomain.com>}"

# Strip accidental protocol / path suffixes from GitHub secret or manual input
API_HOST="$RAW_HOST"
API_HOST="${API_HOST#https://}"
API_HOST="${API_HOST#http://}"
API_HOST="${API_HOST#http//}"
API_HOST="${API_HOST%%/*}"
API_HOST="${API_HOST%/}"

if [ -z "$API_HOST" ]; then
  echo "Invalid API host: $RAW_HOST (use hostname only, e.g. iotbackend.yourdomain.com)"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${ROOT}/dist/caprover-frontend.tgz"
BUILD_DIR="$(mktemp -d)"
API_URL="https://${API_HOST}/api"
SOCKET_URL="https://${API_HOST}"

trap 'rm -rf "$BUILD_DIR"' EXIT

cp -R "${ROOT}/web_frontend/." "$BUILD_DIR/"
rm -rf "$BUILD_DIR/node_modules" "$BUILD_DIR/dist"

sed -i "s|https://ems-api.CHANGE_ME.com/api|${API_URL}|g" "$BUILD_DIR/Dockerfile"
sed -i "s|https://ems-api.CHANGE_ME.com|${SOCKET_URL}|g" "$BUILD_DIR/Dockerfile"

mkdir -p "${ROOT}/dist"
rm -f "$OUT"
tar -czf "$OUT" \
  --exclude=node_modules \
  --exclude=dist \
  -C "$BUILD_DIR" .

echo "Created ${OUT} (API=${API_URL}, Socket=${SOCKET_URL})"
