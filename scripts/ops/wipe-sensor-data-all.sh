#!/usr/bin/env bash
# Wipe ALL EMS sensor telemetry tables on production (or any compose stack).
#
# Default target tables:
#   - sensor_reading_values
#   - sensor_readings
#   - sensor_readings_hourly (if present — Timescale continuous aggregate)
#
# Optional extras (off by default — config / billing / AI stay intact):
#   --also-interval   truncate interval_histories
#   --also-ai         truncate ai_forecast_readings
#   --vacuum          run VACUUM (ANALYZE) after wipe (reclaims disk; can take long)
#
# Safety: refuses to run without --yes
#
# Usage (on the server):
#   cd /opt/smartagritech
#   bash scripts/ops/wipe-sensor-data-all.sh --yes
#   bash scripts/ops/wipe-sensor-data-all.sh --yes --vacuum
#   bash scripts/ops/wipe-sensor-data-all.sh --yes --also-interval --also-ai
#
# Or via docker exec if scripts are only on the host:
#   See docs/ops/wipe-sensor-data.md
#
set -euo pipefail

YES=0
VACUUM=0
ALSO_INTERVAL=0
ALSO_AI=0
PG_CONTAINER="${SMARTAGRITECH_PG_CONTAINER:-}"
PG_USER="${POSTGRES_USER:-ems}"
PG_DB="${POSTGRES_DB:-ems}"

usage() {
  sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y) YES=1 ;;
    --vacuum) VACUUM=1 ;;
    --also-interval) ALSO_INTERVAL=1 ;;
    --also-ai) ALSO_AI=1 ;;
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
  echo "Example: $0 --yes" >&2
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
  # Compose project named after directory
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

PG="$(resolve_pg_container)"
echo "Using postgres container: $PG (user=$PG_USER db=$PG_DB)"
echo

echo "=== BEFORE (row counts) ==="
psql_c -c "
SELECT 'sensor_readings' AS t, COUNT(*)::bigint AS rows FROM sensor_readings
UNION ALL SELECT 'sensor_reading_values', COUNT(*)::bigint FROM sensor_reading_values
UNION ALL SELECT 'sensor_readings_hourly',
  CASE WHEN to_regclass('public.sensor_readings_hourly') IS NULL THEN -1
       ELSE (SELECT COUNT(*)::bigint FROM sensor_readings_hourly) END
UNION ALL SELECT 'interval_histories', COUNT(*)::bigint FROM interval_histories
UNION ALL SELECT 'ai_forecast_readings', COUNT(*)::bigint FROM ai_forecast_readings
ORDER BY 1;"

echo
echo "=== BEFORE (table sizes) ==="
psql_c -c "
SELECT c.relname AS table_name,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','m')
  AND c.relname IN (
    'sensor_readings','sensor_reading_values','sensor_readings_hourly',
    'interval_histories','ai_forecast_readings'
  )
ORDER BY pg_total_relation_size(c.oid) DESC;"

TABLES=("sensor_reading_values" "sensor_readings")
if docker exec "$PG" psql -U "$PG_USER" -d "$PG_DB" -tAc \
  "SELECT to_regclass('public.sensor_readings_hourly')" | grep -qv '^$'; then
  # Continuous aggregate / matview — truncate if it's a plain table; refresh if matview
  KIND="$(docker exec "$PG" psql -U "$PG_USER" -d "$PG_DB" -tAc \
    "SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname='sensor_readings_hourly'")"
  if [[ "$KIND" == "r" ]]; then
    TABLES+=("sensor_readings_hourly")
  fi
fi
if [[ "$ALSO_INTERVAL" -eq 1 ]]; then TABLES+=("interval_histories"); fi
if [[ "$ALSO_AI" -eq 1 ]]; then TABLES+=("ai_forecast_readings"); fi

JOINED="$(printf '%s,' "${TABLES[@]}" | sed 's/,$//')"
echo
echo "=== TRUNCATE: $JOINED ==="
psql_c -c "TRUNCATE TABLE ${JOINED} RESTART IDENTITY;"

# Drop / clear matview hourly if present and not truncated above
if docker exec "$PG" psql -U "$PG_USER" -d "$PG_DB" -tAc \
  "SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='sensor_readings_hourly'" 2>/dev/null | grep -q 'm'; then
  echo "=== Refresh empty sensor_readings_hourly matview ==="
  psql_c -c "REFRESH MATERIALIZED VIEW sensor_readings_hourly;" || true
fi

echo
echo "=== ANALYZE ==="
psql_c -c "ANALYZE sensor_readings; ANALYZE sensor_reading_values;"

if [[ "$VACUUM" -eq 1 ]]; then
  echo
  echo "=== VACUUM (ANALYZE) — may take several minutes ==="
  for t in "${TABLES[@]}"; do
    echo "VACUUM ANALYZE $t ..."
    psql_c -c "VACUUM (ANALYZE) ${t};"
  done
fi

echo
echo "=== AFTER (row counts) ==="
psql_c -c "
SELECT 'sensor_readings' AS t, COUNT(*)::bigint AS rows FROM sensor_readings
UNION ALL SELECT 'sensor_reading_values', COUNT(*)::bigint FROM sensor_reading_values
ORDER BY 1;"

echo
echo "=== AFTER (db + disk hints) ==="
psql_c -c "SELECT pg_size_pretty(pg_database_size('$PG_DB')) AS ems_db;"
docker exec "$PG" du -sh /var/lib/postgresql/data 2>/dev/null || true
df -h / | tail -1 || true

echo
echo "Done. Devices, templates, users, gateways, mqtt_bridges, alarms, slab_rates are preserved."
echo "Optional: docker compose -f /opt/smartagritech/docker-compose.yml restart backend"
