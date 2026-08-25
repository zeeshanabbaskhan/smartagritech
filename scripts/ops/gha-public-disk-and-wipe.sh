#!/usr/bin/env bash
# One-shot: free reclaimable logs if disk is full, wipe sensor telemetry, restart backend.
# Run on the GitHub Actions public host only. Abort if this looks like Friendline.
set -euo pipefail

echo "=== IDENTITY ==="
whoami
hostname
hostname -I || true
echo "PWD=$(pwd)"

IPS="$(hostname -I 2>/dev/null || true)"
HN="$(hostname 2>/dev/null || true)"
if echo "$IPS $HN" | grep -Eq '161\.97\.69\.118|[Ff]riendline|[Ff]riend-line'; then
  echo "ABORT: this host looks like Friendline. Refusing to continue."
  exit 2
fi

echo
echo "=== DF BEFORE ==="
df -h /
df -i / || true

echo
echo "=== DOCKER PS BEFORE ==="
docker ps -a --format '{{.Names}} {{.Status}} {{.Ports}}' || true

PCT="$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
echo "ROOT_USE_PCT=${PCT}"

free_logs() {
  echo
  echo "=== TRUNCATE DOCKER JSON LOGS ==="
  docker run --rm -v /var/lib/docker/containers:/c redis:7-alpine sh -c '
    echo "--- log sizes before ---"
    for f in /c/*/*-json.log; do
      if [ -f "$f" ]; then ls -l "$f"; fi
    done
    echo "--- truncating ---"
    for f in /c/*/*-json.log; do
      if [ -f "$f" ]; then truncate -s 0 "$f"; fi
    done
    echo "--- log sizes after ---"
    for f in /c/*/*-json.log; do
      if [ -f "$f" ]; then ls -l "$f"; fi
    done
  '

  echo
  echo "=== DELETE ROTATED JOURNALS ==="
  docker run --rm -v /var/log/journal:/j redis:7-alpine sh -c '
    echo "--- journal files before ---"
    find /j -type f -exec ls -l {} \;
    find /j -type f | while read -r f; do
      b=$(basename "$f")
      case "$b" in
        system.journal|user-1000.journal|user-1001.journal) echo "KEEP $f" ;;
        *) rm -f "$f"; echo "REMOVED $f" ;;
      esac
    done
    echo "--- journal files after ---"
    find /j -type f -exec ls -l {} \;
  '

  echo
  echo "=== TRUNCATE mqtt-server.err AND EMS LOGS ==="
  docker run --rm -v /var/log:/l redis:7-alpine sh -c '
    if [ -f /l/mqtt-server.err ]; then
      ls -l /l/mqtt-server.err
      truncate -s 0 /l/mqtt-server.err
      echo truncated /l/mqtt-server.err
    else
      echo no /l/mqtt-server.err
    fi
  '
  docker run --rm -v /var/www/ems/Logs:/l redis:7-alpine sh -c '
    if [ -d /l ]; then
      echo "--- EMS Logs before ---"
      ls -lh /l || true
      for f in /l/*; do
        if [ -f "$f" ]; then
          sz=$(wc -c < "$f" || echo 0)
          echo "truncate $f bytes=$sz"
          truncate -s 0 "$f"
        fi
      done
      echo "--- EMS Logs after ---"
      ls -lh /l || true
    else
      echo no /var/www/ems/Logs
    fi
  '
}

if [ "${PCT:-100}" -ge 95 ]; then
  echo "Disk usage ${PCT}% — freeing reclaimable logs first so Postgres can start."
  free_logs
  echo
  echo "=== DF AFTER LOG TRUNCATE ==="
  df -h /
fi

echo
echo "=== ENSURE POSTGRES UP ==="
cd /opt/smartagritech
docker compose --profile bundled-db up -d postgres redis || docker compose up -d postgres redis || true
sleep 8
docker ps -a --filter name=smartagritech-postgres --format '{{.Names}} {{.Status}}'
PG=smartagritech-postgres-1
if ! docker ps --format '{{.Names}}' | grep -qx "$PG"; then
  echo "Postgres container missing; trying compose up"
  docker compose --profile bundled-db up -d
  sleep 12
fi

# Restart postgres if not healthy
if ! docker exec "$PG" pg_isready -U ems -d ems; then
  echo "Postgres not ready — restarting"
  docker restart "$PG" || true
  i=0
  while [ "$i" -lt 30 ]; do
    if docker exec "$PG" pg_isready -U ems -d ems; then
      break
    fi
    i=$((i + 1))
    sleep 3
  done
fi

echo
echo "=== DB SIZE BEFORE WIPE ==="
docker exec "$PG" psql -U ems -d ems -c "SELECT pg_size_pretty(pg_database_size('ems')) AS ems_db;"
docker exec "$PG" du -sh /var/lib/postgresql/data || true

echo
echo "=== WIPE SENSOR TELEMETRY ==="
sed -i 's/\r$//' /tmp/wipe-sensor-data-all.sh
chmod +x /tmp/wipe-sensor-data-all.sh
set +e
bash /tmp/wipe-sensor-data-all.sh --container "$PG" --user ems --db ems --yes --vacuum
WIPE_RC=$?
set -e
echo "WIPE_RC=$WIPE_RC"

if [ "$WIPE_RC" -ne 0 ]; then
  echo "Wipe/VACUUM failed — retrying VACUUM FULL ANALYZE in one psql session (low shm)"
  docker exec -i "$PG" psql -U ems -d ems <<'SQL'
SET max_parallel_maintenance_workers=0;
SET maintenance_work_mem=32768;
VACUUM FULL ANALYZE sensor_reading_values;
VACUUM FULL ANALYZE sensor_readings;
SELECT pg_size_pretty(pg_database_size('ems')) AS ems_db;
SQL
fi

echo
echo "=== DB SIZE AFTER ==="
docker exec "$PG" psql -U ems -d ems -c "SELECT pg_size_pretty(pg_database_size('ems')) AS ems_db;"
docker exec "$PG" du -sh /var/lib/postgresql/data || true

echo
echo "=== RESTART BACKEND ==="
docker compose restart backend || docker restart smartagritech-backend-1
i=0
while [ "$i" -lt 40 ]; do
  if curl -fsS http://127.0.0.1:9001/health; then
    echo
    echo "BACKEND_HEALTHY"
    break
  fi
  i=$((i + 1))
  sleep 3
done

echo
echo "=== HEALTH JSON ==="
curl -sS http://127.0.0.1:9001/health || true
echo

echo
echo "=== DOCKER PS AFTER ==="
docker ps -a --format '{{.Names}} {{.Status}}'

echo
echo "=== DF AFTER ==="
df -h /

echo
echo "DONE"
