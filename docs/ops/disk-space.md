# Disk space (production)

Host: `51.38.88.130` · stack: `/opt/smartagritech`.

Telemetry tables historically dominate disk: **`sensor_readings`** (JSON payload per ingest) and especially **`sensor_reading_values`** (one row per variable per reading). When free space is low, deploys fail (`no space left on device`), Postgres writes fail, and the backend flaps.

## Check free space

```bash
df -h /
df -i /          # inode exhaustion is rarer but real
du -xh /opt --max-depth=2 2>/dev/null | sort -h | tail -20
du -xh /var/lib/docker --max-depth=1 2>/dev/null | sort -h | tail
```

## Docker usage

```bash
docker system df
docker system df -v | head -80
```

Safe reclaim (used by `scripts/deploy/remote-up.sh` during deploys):

```bash
docker builder prune -af
docker image prune -af
docker container prune -f
```

Avoid `docker volume prune` unless you know unused volumes are disposable — **`ems-postgres-data` holds the database**.

## Postgres data size

```bash
# Container name on this stack is usually:
docker exec smartagritech-postgres-1 du -sh /var/lib/postgresql/data

docker exec smartagritech-postgres-1 psql -U ems -d ems -c \
  "SELECT pg_size_pretty(pg_database_size('ems')) AS ems_db;"
```

### Largest tables

```sql
SELECT c.relname AS table_name,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
       pg_size_pretty(pg_relation_size(c.oid)) AS heap_size,
       pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid)) AS idx_toast
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'm')
ORDER BY pg_total_relation_size(c.oid) DESC
LIMIT 20;
```

### Telemetry row counts

```sql
SELECT 'sensor_readings' AS t, COUNT(*) FROM sensor_readings
UNION ALL
SELECT 'sensor_reading_values', COUNT(*) FROM sensor_reading_values;
```

### Growth by day (readings)

```sql
SELECT date_trunc('day', timestamp) AS day, COUNT(*) AS readings
FROM sensor_readings
GROUP BY 1
ORDER BY 1 DESC
LIMIT 30;
```

## What grew historically

| Object | Why it grows |
|--------|----------------|
| `sensor_reading_values` | One float row per variable per ingest (`ingestService` → `createMany`) |
| `sensor_readings` | Parent row + `readings` JSON blob |
| `sensor_readings_hourly` | Optional Timescale continuous aggregate / matview (only if Timescale setup ran) |
| Docker build cache / old images | Repeated `docker compose up --build` |
| `/opt/mqtt/mqtt_to_http.log` | Legacy MQTT→HTTP bridge debug log (can reach multi‑GB) |

Config tables (`devices`, `device_templates`, `users`, `mqtt_bridges`, etc.) stay small.

## Other large files to check

```bash
ls -lh /opt/mqtt/mqtt_to_http.log 2>/dev/null || true
journalctl --disk-usage
du -sh /var/log/* 2>/dev/null | sort -h | tail
```

## When to wipe sensor data

Wipe (see [wipe-sensor-data.md](./wipe-sensor-data.md)) when:

- `df -h /` shows **&lt; ~15–20% free** and largest tables are the sensor_* ones
- Deploys fail with `no space left on device`
- You already exported / no longer need historical charts for a period

Prefer **wipe until datetime** if you need recent history; use **wipe all** for emergency reclaim.

After large deletes, run scripts with `--vacuum` so Postgres returns space to the OS (TRUNCATE already marks space reusable; VACUUM FULL is rarely needed and locks tables).

## After freeing space

```bash
df -h /
cd /opt/smartagritech
docker compose ps
curl -sS http://127.0.0.1:9001/health ; echo
```
