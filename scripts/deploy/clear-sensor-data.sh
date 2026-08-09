#!/bin/bash
# Legacy one-shot truncate. Prefer:
#   scripts/ops/wipe-sensor-data-all.sh --yes
#   scripts/ops/wipe-sensor-data-until.sh --until '...' --yes
# See docs/ops/wipe-sensor-data.md
set -euo pipefail
echo "=== BEFORE ==="
df -h / | tail -1
docker exec smartagritech-postgres-1 du -sh /var/lib/postgresql/data
docker exec smartagritech-postgres-1 psql -U ems -d ems -c "SELECT pg_size_pretty(pg_database_size('ems')) AS ems_db;"
docker exec smartagritech-postgres-1 psql -U ems -d ems -c "
SELECT c.relname AS table_name,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC
LIMIT 15;"
docker exec smartagritech-postgres-1 psql -U ems -d ems -c "
SELECT 'sensor_readings' AS t, COUNT(*)::text AS rows FROM sensor_readings
UNION ALL SELECT 'sensor_reading_values', COUNT(*)::text FROM sensor_reading_values;"

echo "=== TRUNCATE SENSOR DATA ==="
docker exec smartagritech-postgres-1 psql -U ems -d ems -v ON_ERROR_STOP=1 -c "
TRUNCATE TABLE sensor_reading_values, sensor_readings RESTART IDENTITY;"

echo "=== ANALYZE ==="
docker exec smartagritech-postgres-1 psql -U ems -d ems -c "ANALYZE sensor_readings; ANALYZE sensor_reading_values;"

echo "=== AFTER ==="
docker exec smartagritech-postgres-1 psql -U ems -d ems -c "SELECT pg_size_pretty(pg_database_size('ems')) AS ems_db;"
docker exec smartagritech-postgres-1 du -sh /var/lib/postgresql/data
docker exec smartagritech-postgres-1 psql -U ems -d ems -c "
SELECT c.relname AS table_name,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN ('sensor_readings','sensor_reading_values')
ORDER BY c.relname;"
df -h / | tail -1

echo "=== RESTART BACKEND ==="
cd /opt/smartagritech
docker compose restart backend postgres
sleep 8
docker compose ps
curl -sS -m 8 http://127.0.0.1:9001/health || echo HEALTH_FAIL
