#!/usr/bin/env bash
# Pack frontend tarball for Linux Docker Compose deploy (run from repo root).
#
# With a domain (HTTPS):
#   ./scripts/deploy/pack-frontend.sh api.yourdomain.com
#
# With server IP only (HTTP — no domain):
#   ./scripts/deploy/pack-frontend.sh http://YOUR_SERVER_IP:9001
#
set -euo pipefail

RAW="${1:?Usage: pack-frontend.sh <api-host|http://IP:9001>}"

SCHEME=https
HOSTPORT="$RAW"

case "$RAW" in
  https://*)
    SCHEME=https
    HOSTPORT="${RAW#https://}"
    ;;
  http://*)
    SCHEME=http
    HOSTPORT="${RAW#http://}"
    ;;
  http//*)
    SCHEME=http
    HOSTPORT="${RAW#http//}"
    ;;
esac

HOSTPORT="${HOSTPORT%%/*}"
HOSTPORT="${HOSTPORT%/}"

if [ -z "$HOSTPORT" ]; then
  echo "Invalid API host: $RAW"
  echo "Examples: api.yourdomain.com   OR   http://203.0.113.10:9001"
  exit 1
fi

# Bare IPv4 without scheme → HTTP (no TLS without a domain)
if [[ "$SCHEME" == "https" && "$RAW" != https://* && "$HOSTPORT" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+(:[0-9]+)?$ ]]; then
  SCHEME=http
fi

# IP without port → backend publish port 9001
if [[ "$HOSTPORT" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  HOSTPORT="${HOSTPORT}:9001"
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${ROOT}/dist/ems-frontend.tgz"
BUILD_DIR="$(mktemp -d)"
API_URL="${SCHEME}://${HOSTPORT}/api"
SOCKET_URL="${SCHEME}://${HOSTPORT}"

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
