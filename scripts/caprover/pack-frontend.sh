#!/usr/bin/env bash
# Deprecated: CapRover pack — use scripts/deploy/pack-frontend.sh
exec "$(cd "$(dirname "$0")/.." && pwd)/deploy/pack-frontend.sh" "$@"
