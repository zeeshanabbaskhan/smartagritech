# Wipe sensor data (production)

Scripts live in `scripts/ops/`. They target Compose Postgres (`smartagritech-postgres-1` by default) and refuse to run without **`--yes`**.

## What is wiped vs preserved

### Default wipe (all / until)

| Wiped | Preserved |
|-------|-----------|
| `sensor_readings` | `organizations`, `users`, `refresh_tokens` |
| `sensor_reading_values` | `devices`, `gateways`, `device_templates` (+ slaves/variables) |
| `sensor_readings_hourly` (if plain table) | `device_config_slaves` / `device_config_variables` (incl. `currentValue`) |
| | `mqtt_bridges`, `mqtt_configs` |
| | `access_groups`, `device_groups`, facilities, custom dashboards |
| | `alarm_*`, template triggers, scheduled tasks |
| | `slab_rates`, `interval_histories` (unless `--also-interval`) |
| | `ai_forecast_readings` (unless `--also-ai`) |
| | uploads volume / icons / themes |

**Note:** Live UI “latest” values may still appear from **Redis** keys `device:{id}:latest*` and from `device_config_variables.currentValue` until new ingest overwrites them. Wiping DB history does **not** delete devices.

### Semantics: wipe until

`wipe-sensor-data-until.sh` deletes rows where **`timestamp < cutoff`** (exclusive).

- Rows **at or after** the cutoff are kept.
- Example: `--until '2026-08-01 00:00:00+00'` removes everything before 1 Aug 00:00 UTC.

## Install scripts on the server

```bash
ssh USER@51.38.88.130
sudo mkdir -p /opt/smartagritech/scripts/ops
# from a fresh clone or scp — see docs/ops/README.md
sudo cp /path/to/wipe-sensor-data-*.sh /opt/smartagritech/scripts/ops/
sudo chmod +x /opt/smartagritech/scripts/ops/*.sh
```

## Production: wipe ALL telemetry

```bash
ssh USER@51.38.88.130
cd /opt/smartagritech

# Dry run mindset: inspect sizes first
docker exec smartagritech-postgres-1 psql -U ems -d ems -c "
SELECT 'sensor_readings' t, COUNT(*) FROM sensor_readings
UNION ALL SELECT 'sensor_reading_values', COUNT(*) FROM sensor_reading_values;"

# Wipe (required --yes)
sudo bash scripts/ops/wipe-sensor-data-all.sh --yes

# Optional: reclaim OS disk more aggressively (can take minutes)
sudo bash scripts/ops/wipe-sensor-data-all.sh --yes --vacuum

# Optional: also clear billing intervals / AI forecasts
sudo bash scripts/ops/wipe-sensor-data-all.sh --yes --also-interval --also-ai
```

Legacy one-shot (same truncate of the two main tables + restart): `scripts/deploy/clear-sensor-data.sh`.

## Production: wipe until datetime

```bash
cd /opt/smartagritech

# Keep data from 2026-08-01 00:00 UTC onward; delete strictly older
sudo bash scripts/ops/wipe-sensor-data-until.sh \
  --until '2026-08-01 00:00:00+00' \
  --yes

# Larger batches / vacuum
sudo bash scripts/ops/wipe-sensor-data-until.sh \
  --until '2026-08-01T00:00:00Z' \
  --batch-size 100000 \
  --yes --vacuum
```

Timezone tip: store/ops cutoffs in **UTC** (`+00` / `Z`) unless you intentionally use PKT (`+05`).

## Overrides

```bash
export SMARTAGRITECH_PG_CONTAINER=smartagritech-postgres-1
export POSTGRES_USER=ems
export POSTGRES_DB=ems

bash scripts/ops/wipe-sensor-data-all.sh --container smartagritech-postgres-1 --user ems --db ems --yes
```

## Verification

```bash
docker exec smartagritech-postgres-1 psql -U ems -d ems -c "
SELECT 'sensor_readings' t, COUNT(*) FROM sensor_readings
UNION ALL SELECT 'sensor_reading_values', COUNT(*) FROM sensor_reading_values;"

# After until-wipe: nothing older than cutoff
docker exec smartagritech-postgres-1 psql -U ems -d ems -c "
SELECT MIN(timestamp) AS oldest, MAX(timestamp) AS newest, COUNT(*)
FROM sensor_readings;"

df -h /
curl -sS http://127.0.0.1:9001/health ; echo
```

Optional backend bounce:

```bash
cd /opt/smartagritech
docker compose restart backend
```

## What this does *not* do

- Does not drop the database or recreate volumes
- Does not reset MQTT bridge counters (`messagesReceived`) unless you update those rows yourself
- Does not clear Redis latest hashes (TTL 3600s — or flush selectively if needed; see [mqtt-live-data.md](./mqtt-live-data.md))
