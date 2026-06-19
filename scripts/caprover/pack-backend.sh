#!/usr/bin/env bash
# Pack backend tarball for CapRover (run from repo root).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${ROOT}/dist/caprover-backend.tgz"

mkdir -p "${ROOT}/dist"
rm -f "$OUT"

tar -czf "$OUT" \
  --exclude=node_modules \
  -C "${ROOT}/ems/ems-backend" .

echo "Created ${OUT}"
