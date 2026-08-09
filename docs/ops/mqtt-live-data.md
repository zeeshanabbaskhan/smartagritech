# MQTT / live data verification

How to confirm gateways/devices are still feeding the EMS after deploy or a telemetry wipe.

## Architecture (this repo)

1. Org **MQTT bridge** rows in `mqtt_bridges` (managed by `mqttBridgeService.js`) subscribe to a broker topic (default `/UploadTopic`).
2. JSON payloads are mapped by `serial_number` / `device` name → EMS `devices`, then register keys → template `registerAddress` → variable names.
3. `processIngest` / BullMQ ingest writes:
   - `sensor_readings` (+ JSON `readings`)
   - `sensor_reading_values`
   - Redis hashes `device:{deviceId}:latest:{slaveId}` (+ legacy `device:{deviceId}:latest`)
   - updates `devices.lastDataReceivedAt` / presence

Optional legacy path: HTTP `POST /api/ingest` and `/opt/mqtt/mqtt_to_http.log`.

## 1. Backend health + ingest mode

```bash
curl -sS http://127.0.0.1:9001/health ; echo
# expect redis:true and ingestMode:"queued" when Redis is up
```

## 2. MQTT bridge status (SQL)

```sql
SELECT id, name, "organizationId", "brokerHost", "brokerPort",
       "subscribeTopic", enabled, status,
       "lastMessageAt", "messagesReceived", "lastError", "updatedAt"
FROM mqtt_bridges
ORDER BY "updatedAt" DESC;
```

| `status` | Meaning |
|----------|---------|
| `CONNECTED` / similar live states | Bridge client up (see service updates) |
| `STOPPED` | Not running / disabled |
| Rising `messagesReceived` + fresh `lastMessageAt` | Broker traffic reaching the bridge |
| `lastError` about “No matching device” | Payload serial/name not mapped |

API (authenticated admin): MQTT bridge CRUD under backend routes wired from `mqttBridgeController`.

## 3. Backend log greps

```bash
cd /opt/smartagritech
docker compose logs -f --tail=100 backend 2>&1 | grep -Ei 'mqtt bridge|no matching device|non-JSON|ingest'
```

## 4. Redis latest keys

Key format from `utils/redisLatest.js`:

- `device:{deviceId}:latest:{slaveId}` — per-slave hot hash (fields = variable names)
- `device:{deviceId}:latest` — legacy merged hash
- TTL ≈ **3600** seconds
- Dirty set: `devices:dirty:latest` (value flush worker)

```bash
# Host Redis (adjust URL from .env REDIS_URL)
redis-cli -u redis://127.0.0.1:6379 ping
redis-cli -u redis://127.0.0.1:6379 --scan --pattern 'device:*:latest*'

# Inspect one device (substitute UUID)
redis-cli -u redis://127.0.0.1:6379 HGETALL 'device:DEVICE_UUID:latest'
```

If Redis is bundled:

```bash
docker exec -it smartagritech-redis-1 redis-cli ping
docker exec smartagritech-redis-1 redis-cli --scan --pattern 'device:*:latest*'
```

## 5. Last reading time per device (SQL)

```sql
SELECT d.name, d.status, d."lastDataReceivedAt",
       dt."lastActiveAt" AS timestamp_table,
       (SELECT MAX(sr.timestamp) FROM sensor_readings sr WHERE sr."deviceId" = d.id) AS last_reading
FROM devices d
LEFT JOIN device_timestamps dt ON dt."deviceId" = d.id
ORDER BY d."lastDataReceivedAt" DESC NULLS LAST;
```

Stale devices (example: no data in 10 minutes):

```sql
SELECT name, status, "lastDataReceivedAt"
FROM devices
WHERE "lastDataReceivedAt" IS NULL
   OR "lastDataReceivedAt" < NOW() - INTERVAL '10 minutes'
ORDER BY "lastDataReceivedAt" NULLS FIRST;
```

## 6. Sample recent values

```sql
SELECT d.name AS device, v."variableName", v.value, v.timestamp
FROM sensor_reading_values v
JOIN devices d ON d.id = v."deviceId"
ORDER BY v.timestamp DESC
LIMIT 50;
```

Per device + variable:

```sql
SELECT timestamp, value
FROM sensor_reading_values
WHERE "deviceId" = 'DEVICE_UUID'
  AND "variableName" = 'Voltage_L1'
ORDER BY timestamp DESC
LIMIT 20;
```

## 7. Example MQTT payload shapes

From `mqttBridgeService.js` meta keys: `device`, `serial_number`, `mac_address`, `sys_time`, `timestamp`, `time`.

**Slave-block (CF-style)** — top-level object per slave; keys are register addresses mapped via `device_template_variables.registerAddress`:

```json
{
  "device": "Pump-01",
  "serial_number": "GW-SERIAL-123",
  "sys_time": "2026-08-09T08:00:00Z",
  "Main": {
    "0001": 230.5,
    "0002": 1.2
  }
}
```

**Flat soil-style** (no slave objects) — shortcuts `M` / `B` / `TX` map to `SoilMoisture` / `BatteryLevel` / `TxCounter` when those config variables exist:

```json
{
  "device": "Soil-Node-1",
  "serial_number": "GW-SERIAL-123",
  "M": 42.5,
  "B": 3.7,
  "TX": 18
}
```

Device resolution order: gateway `serialNumber` (+ optional device name) → device name alone.

## 8. Presence env knobs

From `deploy/linux.env.example`:

- `DEVICE_OFFLINE_AFTER_MS` (default 300000 = 5 min)
- `DEVICE_PRESENCE_CHECK_MS` (default 60000)

If bridges stop, presence service marks devices offline after the stale window.

## 9. After a wipe — expect

- Historical charts empty until new points arrive
- `messagesReceived` on bridges continues to climb if MQTT is healthy
- New rows appear in `sensor_readings` within seconds of a publish
- Redis keys refresh on each successful ingest
