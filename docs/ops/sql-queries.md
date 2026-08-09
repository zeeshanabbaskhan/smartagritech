# SQL query cookbook (EMS production)

Source of truth: `ems/ems-backend/prisma/schema.prisma` (quoted camelCase columns).

Connect:

```bash
docker exec -it smartagritech-postgres-1 psql -U ems -d ems
```

Replace placeholders like `'ORG_UUID'`, `'DEVICE_UUID'`, `'%name%'`.

---

## Table sizes

```sql
SELECT c.relname AS table_name,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
       pg_size_pretty(pg_relation_size(c.oid)) AS heap_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'm')
ORDER BY pg_total_relation_size(c.oid) DESC;
```

```sql
SELECT pg_size_pretty(pg_database_size('ems')) AS ems_db;
```

---

## Organizations

```sql
SELECT id, name, status, "createdAt", "updatedAt"
FROM organizations
ORDER BY name;
```

```sql
SELECT o.name AS org,
       (SELECT COUNT(*) FROM users u WHERE u."organizationId" = o.id) AS users,
       (SELECT COUNT(*) FROM devices d WHERE d."organizationId" = o.id) AS devices,
       (SELECT COUNT(*) FROM gateways g WHERE g."organizationId" = o.id) AS gateways
FROM organizations o
ORDER BY o.name;
```

---

## Users & roles

```sql
SELECT id, "fullName", email, role, status, "organizationId", "createdAt"
FROM users
ORDER BY role, email;
```

```sql
SELECT role, status, COUNT(*)
FROM users
GROUP BY role, status
ORDER BY 1, 2;
```

```sql
SELECT u.email, u.role, u.status, o.name AS org
FROM users u
LEFT JOIN organizations o ON o.id = u."organizationId"
WHERE u.email ILIKE '%admin%';
```

```sql
-- Users in one org
SELECT "fullName", email, role, status
FROM users
WHERE "organizationId" = 'ORG_UUID'
ORDER BY role, email;
```

Roles enum: `SUPER_ADMIN`, `ORG_ADMIN`, `USER`.  
Status enum: `ACTIVE`, `INACTIVE`, `DELETED`.

---

## Devices

```sql
SELECT id, name, status, "switchState", "organizationId", "gatewayId",
       "templateId", "lastDataReceivedAt", "createdAt"
FROM devices
ORDER BY name;
```

```sql
-- By organization
SELECT d.name, d.status, d."lastDataReceivedAt", g.name AS gateway, g."serialNumber"
FROM devices d
LEFT JOIN gateways g ON g.id = d."gatewayId"
WHERE d."organizationId" = 'ORG_UUID'
ORDER BY d.name;
```

```sql
-- Online / offline counts
SELECT status, COUNT(*)
FROM devices
GROUP BY status;
```

```sql
SELECT o.name AS org, d.status, COUNT(*)
FROM devices d
JOIN organizations o ON o.id = d."organizationId"
GROUP BY o.name, d.status
ORDER BY o.name, d.status;
```

```sql
-- Find device by name
SELECT d.*, o.name AS org_name
FROM devices d
JOIN organizations o ON o.id = d."organizationId"
WHERE d.name ILIKE '%Pump%';
```

```sql
-- Stale / never received
SELECT name, status, "lastDataReceivedAt"
FROM devices
WHERE "lastDataReceivedAt" IS NULL
   OR "lastDataReceivedAt" < NOW() - INTERVAL '15 minutes'
ORDER BY "lastDataReceivedAt" NULLS FIRST;
```

---

## Gateways

```sql
SELECT id, name, "serialNumber", model, status, "organizationId",
       "lastSeenAt", "createdAt"
FROM gateways
ORDER BY name;
```

```sql
SELECT g.name, g."serialNumber", g.status, o.name AS org,
       (SELECT COUNT(*) FROM devices d WHERE d."gatewayId" = g.id) AS device_count
FROM gateways g
JOIN organizations o ON o.id = g."organizationId"
ORDER BY o.name, g.name;
```

Gateway status enum: `ONLINE`, `OFFLINE`, `UPGRADING`, `IN_CONFIGURATION`, `GATEWAY_ALARM`, `DISABLED`.

---

## MQTT configs & bridges

```sql
SELECT id, "organizationId", "brokerUrl", port, topic, "isActive", "createdAt"
FROM mqtt_configs
ORDER BY "createdAt" DESC;
```

```sql
SELECT id, name, "organizationId", "brokerHost", "brokerPort", username,
       "subscribeTopic", "commandTopic", enabled, status,
       "lastMessageAt", "messagesReceived", "lastError"
FROM mqtt_bridges
ORDER BY "updatedAt" DESC;
```

```sql
-- Bridges that have not received a message recently
SELECT name, status, enabled, "lastMessageAt", "messagesReceived", "lastError"
FROM mqtt_bridges
WHERE enabled = true
  AND ("lastMessageAt" IS NULL OR "lastMessageAt" < NOW() - INTERVAL '10 minutes');
```

---

## Device templates, slaves, variables (register addresses)

```sql
SELECT id, name, "organizationId", "acquisitionMethod",
       "totalSlaves", "totalVariables", "createdAt"
FROM device_templates
ORDER BY name;
```

```sql
-- Slaves for a template
SELECT s.id, s.name, s.protocol, s."isDefault", s."templateId"
FROM device_template_slaves s
WHERE s."templateId" = 'TEMPLATE_UUID'
ORDER BY s.name;
```

```sql
-- Variables + register addresses for a template slave
SELECT v.name, v."displayName", v.unit, v."registerAddress",
       v."dataType", v."variableType", v."isActive",
       v."acquisitionFormula", v."controlFormula"
FROM device_template_variables v
WHERE v."templateSlaveId" = 'TEMPLATE_SLAVE_UUID'
ORDER BY v."sortOrder" NULLS LAST, v.name;
```

```sql
-- Full template tree for an org
SELECT t.name AS template, s.name AS slave,
       v.name AS variable, v."registerAddress", v.unit, v."dataType"
FROM device_templates t
JOIN device_template_slaves s ON s."templateId" = t.id
JOIN device_template_variables v ON v."templateSlaveId" = s.id
WHERE t."organizationId" = 'ORG_UUID'
ORDER BY t.name, s.name, v.name;
```

---

## Device config slaves & variables (per device instance)

```sql
-- Slaves for a device
SELECT s.id, s.name, s."isDefault", s."isActive", s."templateSlaveId"
FROM device_config_slaves s
WHERE s."deviceId" = 'DEVICE_UUID'
ORDER BY s.name;
```

```sql
-- Config variables (live currentValue) for a device
SELECT cv.name, cv."displayName", cv.unit, cv."currentValue", cv."lastUpdatedAt",
       cs.name AS slave, tv."registerAddress"
FROM device_config_variables cv
JOIN device_config_slaves cs ON cs.id = cv."deviceConfigSlaveId"
LEFT JOIN device_template_variables tv ON tv.id = cv."templateVariableId"
WHERE cv."deviceId" = 'DEVICE_UUID'
ORDER BY cs.name, cv.name;
```

```sql
-- List slaves for device by name
SELECT d.name AS device, s.id AS slave_id, s.name AS slave
FROM devices d
JOIN device_config_slaves s ON s."deviceId" = d.id
WHERE d.name ILIKE '%DEVICE_NAME%';
```

```sql
-- List variables for a slave
SELECT cv.name, cv."currentValue", cv.unit, cv."lastUpdatedAt"
FROM device_config_variables cv
WHERE cv."deviceConfigSlaveId" = 'SLAVE_UUID'
ORDER BY cv.name;
```

---

## Access groups & device groups

```sql
SELECT ag.id, ag.name, o.name AS org, ag."createdAt"
FROM access_groups ag
JOIN organizations o ON o.id = ag."organizationId"
ORDER BY o.name, ag.name;
```

```sql
-- Access group membership (devices)
SELECT ag.name AS access_group, d.name AS device, d.status
FROM access_group_devices agd
JOIN access_groups ag ON ag.id = agd."accessGroupId"
JOIN devices d ON d.id = agd."deviceId"
WHERE ag."organizationId" = 'ORG_UUID'
ORDER BY ag.name, d.name;
```

```sql
-- Access group membership (users)
SELECT ag.name AS access_group, u.email, u.role
FROM access_group_users agu
JOIN access_groups ag ON ag.id = agu."accessGroupId"
JOIN users u ON u.id = agu."userId"
WHERE ag."organizationId" = 'ORG_UUID'
ORDER BY ag.name, u.email;
```

```sql
SELECT dg.id, dg.name, dg."isActive", o.name AS org
FROM device_groups dg
JOIN organizations o ON o.id = dg."organizationId"
ORDER BY o.name, dg.name;
```

```sql
SELECT dg.name AS device_group, d.name AS device
FROM device_group_devices dgd
JOIN device_groups dg ON dg.id = dgd."deviceGroupId"
JOIN devices d ON d.id = dgd."deviceId"
WHERE dg."organizationId" = 'ORG_UUID'
ORDER BY dg.name, d.name;
```

```sql
SELECT dg.name AS device_group, u.email
FROM device_group_users dgu
JOIN device_groups dg ON dg.id = dgu."deviceGroupId"
JOIN users u ON u.id = dgu."userId"
WHERE dg."organizationId" = 'ORG_UUID';
```

---

## Sensor readings & values

### Counts & range

```sql
SELECT 'sensor_readings' AS t, COUNT(*) FROM sensor_readings
UNION ALL
SELECT 'sensor_reading_values', COUNT(*) FROM sensor_reading_values;
```

```sql
SELECT MIN(timestamp) AS oldest, MAX(timestamp) AS newest, COUNT(*)
FROM sensor_readings;
```

```sql
SELECT MIN(timestamp) AS oldest, MAX(timestamp) AS newest, COUNT(*)
FROM sensor_reading_values;
```

### Size of telemetry tables

```sql
SELECT relname,
       pg_size_pretty(pg_total_relation_size(oid)) AS total
FROM pg_class
WHERE relname IN ('sensor_readings', 'sensor_reading_values', 'sensor_readings_hourly');
```

### Counts by device

```sql
SELECT d.name, COUNT(*) AS readings
FROM sensor_readings sr
JOIN devices d ON d.id = sr."deviceId"
GROUP BY d.name
ORDER BY readings DESC;
```

```sql
SELECT d.name, COUNT(*) AS value_rows
FROM sensor_reading_values v
JOIN devices d ON d.id = v."deviceId"
GROUP BY d.name
ORDER BY value_rows DESC
LIMIT 50;
```

### Latest reading per device

```sql
SELECT DISTINCT ON (sr."deviceId")
  d.name, sr.timestamp, sr.id AS reading_id
FROM sensor_readings sr
JOIN devices d ON d.id = sr."deviceId"
ORDER BY sr."deviceId", sr.timestamp DESC;
```

### By variable

```sql
SELECT "variableName", COUNT(*) AS n,
       MIN(timestamp) AS first_ts, MAX(timestamp) AS last_ts,
       AVG(value) AS avg_value
FROM sensor_reading_values
WHERE "deviceId" = 'DEVICE_UUID'
GROUP BY "variableName"
ORDER BY "variableName";
```

### By date range

```sql
SELECT date_trunc('hour', timestamp) AS hour, COUNT(*)
FROM sensor_readings
WHERE timestamp >= TIMESTAMPTZ '2026-08-01 00:00:00+00'
  AND timestamp <  TIMESTAMPTZ '2026-08-02 00:00:00+00'
GROUP BY 1
ORDER BY 1;
```

```sql
SELECT timestamp, "variableName", value
FROM sensor_reading_values
WHERE "deviceId" = 'DEVICE_UUID'
  AND timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC
LIMIT 200;
```

### By slave

```sql
SELECT cs.name AS slave, COUNT(*) AS readings
FROM sensor_readings sr
JOIN device_config_slaves cs ON cs.id = sr."deviceConfigSlaveId"
WHERE sr."deviceId" = 'DEVICE_UUID'
GROUP BY cs.name
ORDER BY readings DESC;
```

```sql
SELECT cs.name AS slave, v."variableName", COUNT(*) AS n, MAX(v.timestamp) AS last_ts
FROM sensor_reading_values v
LEFT JOIN device_config_slaves cs ON cs.id = v."deviceConfigSlaveId"
WHERE v."deviceId" = 'DEVICE_UUID'
GROUP BY cs.name, v."variableName"
ORDER BY cs.name, v."variableName";
```

### Sample recent values for a device / variable

```sql
SELECT timestamp, value, "deviceConfigSlaveId"
FROM sensor_reading_values
WHERE "deviceId" = 'DEVICE_UUID'
  AND "variableName" = 'VARIABLE_NAME'
ORDER BY timestamp DESC
LIMIT 50;
```

```sql
-- Parent JSON payload sample
SELECT timestamp, readings
FROM sensor_readings
WHERE "deviceId" = 'DEVICE_UUID'
ORDER BY timestamp DESC
LIMIT 5;
```

### By organization

```sql
SELECT o.name, COUNT(*) AS readings
FROM sensor_readings sr
JOIN organizations o ON o.id = sr."organizationId"
GROUP BY o.name
ORDER BY readings DESC;
```

---

## Device timestamps

```sql
SELECT d.name, dt."lastActiveAt", d."lastDataReceivedAt", d.status
FROM device_timestamps dt
JOIN devices d ON d.id = dt."deviceId"
ORDER BY dt."lastActiveAt" DESC;
```

---

## Interval histories (energy / tariff calculations)

```sql
SELECT id, "deviceId", "variableName", "slaveName",
       "totalUnit", tariff, "startDate", "endDate", "computedAt"
FROM interval_histories
ORDER BY "computedAt" DESC
LIMIT 100;
```

```sql
SELECT d.name, ih."variableName", ih."totalUnit", ih.tariff,
       ih."startDate", ih."endDate"
FROM interval_histories ih
LEFT JOIN devices d ON d.id = ih."deviceId"
WHERE ih."organizationId" = 'ORG_UUID'
ORDER BY ih."endDate" DESC
LIMIT 100;
```

---

## Slab rates

```sql
SELECT sr.id, cs.name AS slave, sr."unitFrom", sr."unitTo",
       sr.rate, sr."onPeakRate", sr."offPeakRate", sr."organizationId"
FROM slab_rates sr
JOIN device_config_slaves cs ON cs.id = sr."deviceConfigSlaveId"
ORDER BY cs.name, sr."unitFrom";
```

```sql
SELECT sr.*, d.name AS device
FROM slab_rates sr
JOIN device_config_slaves cs ON cs.id = sr."deviceConfigSlaveId"
JOIN devices d ON d.id = cs."deviceId"
WHERE d.id = 'DEVICE_UUID';
```

---

## Scheduled tasks

```sql
SELECT st.id, d.name AS device, st."variableName", st.action,
       st."scheduledTime", st."repeatType", st.status, st."nextRunAt"
FROM scheduled_tasks st
JOIN devices d ON d.id = st."deviceId"
ORDER BY st."nextRunAt" NULLS LAST;
```

```sql
SELECT st.*, d.name
FROM scheduled_tasks st
JOIN devices d ON d.id = st."deviceId"
WHERE st."organizationId" = 'ORG_UUID' AND st.status = 'ACTIVE';
```

```sql
SELECT sel."executedAt", sel.action, sel."variableName", sel.result, sel."errorMessage",
       d.name AS device
FROM schedule_execution_logs sel
JOIN devices d ON d.id = sel."deviceId"
ORDER BY sel."executedAt" DESC
LIMIT 50;
```

---

## Alarm templates / settings / history

```sql
-- Template triggers (anomaly / linkage rules on templates)
SELECT tt.id, tt.name, tt."anomalyType", tt.operator, tt.threshold,
       tt.priority, tt."isActive", dt.name AS template
FROM template_triggers tt
JOIN device_templates dt ON dt.id = tt."deviceTemplateId"
WHERE tt."organizationId" = 'ORG_UUID'
ORDER BY tt.name;
```

```sql
SELECT id, name, status, "pushType", "pushMethod", "templateTriggerId", "organizationId"
FROM alarm_settings
ORDER BY name;
```

```sql
-- Devices attached to an alarm setting
SELECT a.name AS alarm, d.name AS device
FROM alarm_configuration_devices acd
JOIN alarm_settings a ON a.id = acd."alarmSettingId"
JOIN devices d ON d.id = acd."deviceId"
ORDER BY a.name, d.name;
```

```sql
SELECT ah."alarmTime", ah."variableName", ah."triggerName", ah."currentValue",
       ah."alarmState", ah."processState", d.name AS device
FROM device_variable_alarm_histories ah
JOIN devices d ON d.id = ah."deviceId"
ORDER BY ah."alarmTime" DESC
LIMIT 100;
```

```sql
SELECT "sentAt", message, "pushType", "sentTo", status, "deviceId"
FROM alarm_history_notifications
ORDER BY "sentAt" DESC
LIMIT 50;
```

---

## AI forecasts

```sql
SELECT id, "deviceId", "variableName", horizon, "generatedAt"
FROM ai_forecast_readings
ORDER BY "generatedAt" DESC
LIMIT 50;
```

---

## Facilities & custom dashboards (CF)

```sql
SELECT id, name, type, "parentId", "organizationId", "sortOrder"
FROM facility_nodes
WHERE "organizationId" = 'ORG_UUID'
ORDER BY "sortOrder", name;
```

```sql
SELECT fn.name AS node, d.name AS device
FROM facility_node_devices fnd
JOIN facility_nodes fn ON fn.id = fnd."facilityNodeId"
JOIN devices d ON d.id = fnd."deviceId"
WHERE fn."organizationId" = 'ORG_UUID';
```

```sql
SELECT id, name, visibility, "ownerUserId", "targetDeviceId", "updatedAt"
FROM custom_dashboards
WHERE "organizationId" = 'ORG_UUID'
ORDER BY "updatedAt" DESC;
```

```sql
SELECT "organizationId", sources, savings, "updatedAt"
FROM power_flow_configs;
```

---

## Device users (legacy assignments)

```sql
SELECT u.email, d.name AS device, du."assignedAt"
FROM device_users du
JOIN users u ON u.id = du."userId"
JOIN devices d ON d.id = du."deviceId"
WHERE du."organizationId" = 'ORG_UUID'
ORDER BY u.email, d.name;
```

---

## Quick “find everything for one device”

```sql
-- 1) Resolve id
SELECT id, name, status, "lastDataReceivedAt", "organizationId", "gatewayId", "templateId"
FROM devices WHERE name ILIKE '%NAME%';

-- 2) Slaves
SELECT id, name, "isActive" FROM device_config_slaves WHERE "deviceId" = 'DEVICE_UUID';

-- 3) Variables
SELECT name, "currentValue", "lastUpdatedAt", unit
FROM device_config_variables WHERE "deviceId" = 'DEVICE_UUID';

-- 4) Latest telemetry
SELECT timestamp, "variableName", value
FROM sensor_reading_values
WHERE "deviceId" = 'DEVICE_UUID'
ORDER BY timestamp DESC
LIMIT 30;
```

---

## Maintenance helpers

```sql
ANALYZE sensor_readings;
ANALYZE sensor_reading_values;
```

```sql
-- Count rows older than a cutoff (preview before wipe-until)
SELECT COUNT(*) FROM sensor_readings
WHERE timestamp < TIMESTAMPTZ '2026-08-01 00:00:00+00';

SELECT COUNT(*) FROM sensor_reading_values
WHERE timestamp < TIMESTAMPTZ '2026-08-01 00:00:00+00';
```
