#!/usr/bin/env bash
# Pack frontend tarball for CapRover (run from repo root).
# Usage: ./scripts/caprover/pack-frontend.sh ems-api.yourdomain.com
#   (public backend hostname — no https://)
set -euo pipefail

API_HOST="${1:?Usage: pack-frontend.sh <api-host e.g. ems-api.yourdomain.com>}"

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
