#!/usr/bin/env bash
# Delete EMS sensor telemetry with timestamp STRICTLY BEFORE a cutoff datetime.
#
# Semantics: DELETE WHERE timestamp < cutoff
#   - Rows AT the cutoff instant are KEPT
#   - Pass an exclusive upper bound (e.g. wipe until start of a day → keep that day onward)
#
# Cutoff formats accepted by PostgreSQL timestamptz:
#   2026-08-01T00:00:00Z
#   2026-08-01 00:00:00+00
#   2026-08-01 05:00:00+05
#
# Default tables:
#   - sensor_reading_values (by timestamp)
#   - sensor_readings (by timestamp)
# Optional:
#   --also-interval / --also-ai  (interval_histories by endDate; ai_forecast by generatedAt)
#   --batch-size N   (default 50000) batched deletes for large tables
#   --vacuum         VACUUM ANALYZE after deletes
#
# Safety: refuses to run without --yes
#
# Usage:
#   bash scripts/ops/wipe-sensor-data-until.sh --until '2026-08-01 00:00:00+00' --yes
#   bash scripts/ops/wipe-sensor-data-until.sh --until '2026-08-01T00:00:00Z' --yes --vacuum
#
set -euo pipefail

YES=0
VACUUM=0
ALSO_INTERVAL=0
ALSO_AI=0
BATCH_SIZE=50000
UNTIL=""
PG_CONTAINER="${SMARTAGRITECH_PG_CONTAINER:-}"
PG_USER="${POSTGRES_USER:-ems}"
PG_DB="${POSTGRES_DB:-ems}"

usage() {
  sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y) YES=1 ;;
    --vacuum) VACUUM=1 ;;
    --also-interval) ALSO_INTERVAL=1 ;;
    --also-ai) ALSO_AI=1 ;;
    --until|--before) UNTIL="${2:?}"; shift ;;
    --batch-size) BATCH_SIZE="${2:?}"; shift ;;
    --container) PG_CONTAINER="${2:?}"; shift ;;
    --user) PG_USER="${2:?}"; shift ;;
    --db) PG_DB="${2:?}"; shift ;;
    -h|--help) usage 0 ;;
    *) echo "Unknown arg: $1" >&2; usage 1 ;;
  esac
  shift
done

if [[ "$YES" -ne 1 ]]; then
  echo "Refusing to wipe without --yes" >&2
  exit 2
fi
if [[ -z "$UNTIL" ]]; then
  echo "Missing --until 'YYYY-MM-DD HH:MM:SS+00' (or ISO timestamptz)" >&2
  exit 2
fi

resolve_pg_container() {
  if [[ -n "$PG_CONTAINER" ]]; then
    echo "$PG_CONTAINER"
    return
  fi
  if docker ps --format '{{.Names}}' | grep -qx 'smartagritech-postgres-1'; then
    echo 'smartagritech-postgres-1'
    return
  fi
  local guess
  guess="$(docker ps --format '{{.Names}}' | grep -E 'postgres' | head -1 || true)"
  if [[ -n "$guess" ]]; then
    echo "$guess"
    return
  fi
  echo "Could not find postgres container. Set SMARTAGRITECH_PG_CONTAINER or --container" >&2
  exit 1
}

psql_c() {
  docker exec -i "$PG" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 "$@"
}

batch_delete() {
  local table="$1"
  local ts_col="$2"
  local total=0
  local n=1
  echo "Deleting from $table where $ts_col < cutoff (batch=$BATCH_SIZE) ..."
  while [[ "$n" -gt 0 ]]; do
    n="$(docker exec -i "$PG" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 -tAc \
      "WITH doomed AS (
         SELECT ctid FROM ${table}
         WHERE ${ts_col} < TIMESTAMPTZ '${UNTIL_ESC}'
         LIMIT ${BATCH_SIZE}
       ),
       deleted AS (
         DELETE FROM ${table} t
         USING doomed d
         WHERE t.ctid = d.ctid
         RETURNING 1
       )
       SELECT COUNT(*)::bigint FROM deleted;")"
    n="$(echo "$n" | tr -d '[:space:]')"
    n="${n:-0}"
    total=$((total + n))
    if [[ "$n" -gt 0 ]]; then
      echo "  batch removed $n (running total $total)"
    fi
  done
  echo "  $table total removed: $total"
}

PG="$(resolve_pg_container)"
# Escape single quotes for SQL literal
UNTIL_ESC="${UNTIL//\'/\'\'}"

echo "Using postgres container: $PG (user=$PG_USER db=$PG_DB)"
echo "Cutoff (exclusive): timestamp < '${UNTIL}'"
echo

# Validate cutoff parses
psql_c -c "SELECT TIMESTAMPTZ '${UNTIL_ESC}' AS cutoff_parsed;"

echo "=== BEFORE (counts older than cutoff / totals) ==="
psql_c -c "
SELECT 'sensor_readings_before' AS metric, COUNT(*)::bigint AS n
  FROM sensor_readings WHERE timestamp < TIMESTAMPTZ '${UNTIL_ESC}'
UNION ALL
SELECT 'sensor_readings_total', COUNT(*)::bigint FROM sensor_readings
UNION ALL
SELECT 'sensor_reading_values_before', COUNT(*)::bigint
  FROM sensor_reading_values WHERE timestamp < TIMESTAMPTZ '${UNTIL_ESC}'
UNION ALL
SELECT 'sensor_reading_values_total', COUNT(*)::bigint FROM sensor_reading_values
ORDER BY 1;"

echo
# Values first (no FK to readings in Prisma, but keep logical order)
batch_delete "sensor_reading_values" "timestamp"
batch_delete "sensor_readings" "timestamp"

if [[ "$ALSO_INTERVAL" -eq 1 ]]; then
  batch_delete "interval_histories" "\"endDate\""
fi
if [[ "$ALSO_AI" -eq 1 ]]; then
  batch_delete "ai_forecast_readings" "\"generatedAt\""
fi

echo
echo "=== ANALYZE ==="
psql_c -c "ANALYZE sensor_readings; ANALYZE sensor_reading_values;"

if [[ "$VACUUM" -eq 1 ]]; then
  echo
  echo "=== VACUUM (ANALYZE) ==="
  psql_c -c "VACUUM (ANALYZE) sensor_reading_values;"
  psql_c -c "VACUUM (ANALYZE) sensor_readings;"
fi

echo
echo "=== AFTER ==="
psql_c -c "
SELECT 'sensor_readings_before' AS metric, COUNT(*)::bigint AS n
  FROM sensor_readings WHERE timestamp < TIMESTAMPTZ '${UNTIL_ESC}'
UNION ALL
SELECT 'sensor_readings_total', COUNT(*)::bigint FROM sensor_readings
UNION ALL
SELECT 'sensor_reading_values_before', COUNT(*)::bigint
  FROM sensor_reading_values WHERE timestamp < TIMESTAMPTZ '${UNTIL_ESC}'
UNION ALL
SELECT 'sensor_reading_values_total', COUNT(*)::bigint FROM sensor_reading_values
ORDER BY 1;"

psql_c -c "SELECT pg_size_pretty(pg_database_size('$PG_DB')) AS ems_db;"
df -h / | tail -1 || true
echo
echo "Done. Rows with timestamp >= cutoff were kept."
