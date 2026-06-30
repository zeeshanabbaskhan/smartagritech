# System overview & flows

This document describes how users, devices, and data move through the Smart AgriTech EMS platform.

## High-level system map

```mermaid
flowchart TB
    subgraph Field
        GW[Gateway / Edge device]
        MQTT[MQTT broker optional]
        BR[script.py MQTT bridge]
    end

    subgraph Platform
        API[EMS Backend API]
        REDIS[(Redis)]
        PG[(PostgreSQL)]
        Q[BullMQ workers]
        SOCK[Socket.IO]
    end

    subgraph Clients
        WEB[Web dashboard React]
        MOB[Flutter mobile app]
    end

    GW -->|HTTP POST /api/ingest| API
    MQTT --> BR -->|HTTP ingest| API
    API --> REDIS
    API --> PG
    API --> Q
    Q --> PG
    API --> SOCK
    SOCK --> WEB
    API -->|REST JWT| WEB
    API -->|REST JWT| MOB
```

## User roles & access

| Role | Backend enum | Web route prefix | Primary responsibilities |
|------|--------------|------------------|---------------------------|
| Super Admin | `SUPER_ADMIN` | `/admin` | All orgs, platform settings, themes, products, global users |
| Org Admin | `ORG_ADMIN` | `/org` | Own org: users, gateways, devices, templates, alarms |
| End User | `USER` | `/user` | Assigned devices only: dashboards, analytics, notifications |

```mermaid
flowchart LR
    LOGIN[Login /api/auth/login] --> JWT[JWT access + refresh]
    JWT --> ROUTE{Role?}
    ROUTE -->|SUPER_ADMIN| ADMIN[/admin/*]
    ROUTE -->|ORG_ADMIN| ORG[/org/*]
    ROUTE -->|USER| USER[/user/*]
```

## Core feature domains

1. **Multi-tenant organizations** — isolated data per org; super admin manages all.
2. **Gateway & device inventory** — physical gateways, logical devices, templates.
3. **Telemetry ingest** — HTTP API (primary); optional MQTT bridge for legacy sensors.
4. **Live dashboards** — latest readings, charts, AI-style analytics pages.
5. **History & export** — raw readings, aggregates, CSV download.
6. **Alarms & linkage** — template triggers, contacts, variable alarm history.
7. **Scheduling** — cron-based device switch tasks.
8. **Notifications** — in-app + email for alarms.
9. **Billing helpers** — slab rates, interval history (energy cost estimation).
10. **Platform config** — themes, icons, products, subscriptions, system settings.

---

## Flow 1: Organization onboarding

```mermaid
sequenceDiagram
    participant SA as Super Admin
    participant API as Backend
    participant DB as PostgreSQL

    SA->>API: POST /api/organizations
    API->>DB: Create Organization
    SA->>API: POST /api/users (ORG_ADMIN)
    API->>DB: Create User linked to org
    SA->>API: POST /api/gateways
    SA->>API: POST /api/device-templates + slaves/variables
    SA->>API: POST /api/devices
    API->>DB: Provision DeviceConfigSlave + variables + ingest API key
    Note over SA,DB: Ingest key returned once on device create
```

**Steps in UI (admin/org):**

1. Create organization (admin only).
2. Create org admin user.
3. Create gateway (serial, org).
4. Create device template with slaves and variables (e.g. `SoilMoisture`, `BatteryLevel`).
5. Create device → select gateway + template → receive **per-device ingest API key**.
6. Assign end users to device (`DeviceUser`).

---

## Flow 2: Device telemetry ingest

```mermaid
sequenceDiagram
    participant DEV as Device / Gateway
    participant ING as POST /api/ingest
    participant AUTH as ingestAuth
    participant Q as BullMQ optional
    participant SVC as ingestService
    participant PG as PostgreSQL
    participant R as Redis
    participant SIO as Socket.IO

    DEV->>ING: x-api-key + deviceId + readings[]
    ING->>AUTH: Validate global or per-device key
    alt REDIS_URL set
        ING->>Q: enqueueIngest batch
        Q->>SVC: processIngestBatch
    else No Redis
        ING->>SVC: processIngest sync
    end
    SVC->>PG: SensorReading + SensorReadingValue
    SVC->>PG: Update device.lastDataReceivedAt
    SVC->>R: HSET device:id:latest
    SVC->>SIO: reading:new debounced
    SVC->>Q: anomaly check job
```

**Ingest payload example:**

```json
{
  "deviceId": "uuid",
  "slaveId": "optional-config-slave-uuid",
  "readings": [
    { "variableName": "SoilMoisture", "value": 42.5, "unit": "%" },
    { "variableName": "BatteryLevel", "value": 88, "unit": "%" }
  ]
}
```

**Modes:**

| Mode | Condition | Behavior |
|------|-----------|----------|
| Queued (production) | `REDIS_URL` set | BullMQ micro-batches (`INGEST_BATCH_MAX` / `INGEST_BATCH_MS`) |
| Sync (dev) | No Redis | Immediate DB write per request |

---

## Flow 3: MQTT field sensors (optional)

For hardware that publishes to MQTT (e.g. SMM soil topic):

```mermaid
flowchart LR
    SENSOR[Soil sensor] -->|MQTT| BROKER[Broker 10.x:1883]
    BROKER --> PY[script.py]
    PY -->|POST /api/ingest| API[Backend]
```

`script.py` maps `M` → `SoilMoisture`, `B` → `BatteryLevel`, `TX` → `TxCounter`.

Environment: `EMS_BASE_URL`, `EMS_INGEST_API_KEY`, `EMS_DEVICE_ID`, `MQTT_BROKER_IP`.

---

## Flow 4: Live dashboard viewing

```mermaid
sequenceDiagram
    participant U as User browser
    participant WEB as React app
    participant API as Backend
    participant SIO as Socket.IO

    U->>WEB: Select device in DeviceSlaveSelector
    WEB->>API: GET /sensor-data/latest?deviceId=
    WEB->>API: GET /sensor-data/dashboard-summary
    WEB->>SIO: connect auth token + join:device
    SIO-->>WEB: reading:new
    WEB->>API: Refresh latest readings
```

Device context (`DeviceContext`) keeps selected device/slave across dashboard, detail, and history pages.

---

## Flow 5: Alarm detection & notification

```mermaid
flowchart TB
    ING[Ingest completes] --> AD[anomalyDetector]
    AD --> TT{TemplateTrigger rules}
    TT -->|breach| HIST[DeviceVariableAlarmHistory]
    HIST --> NOTIF[Notification rows]
    HIST --> EMAIL[Email queue optional]
    HIST --> SIO[alarm:new to org room]
    TT -->|linkage| LINK[DeviceVariableLinkageHistory]
```

**Admin/org configures:**

- Template triggers (variable, operator, threshold).
- Alarm settings & contacts (email, phone, WhatsApp fields).
- Alarm history UI for process/resolve.

---

## Flow 6: Remote device switch (command)

```mermaid
sequenceDiagram
    participant UI as Admin UI
    participant API as PATCH /devices/:id/switch
    participant CMD as DeviceCommand PENDING
    participant SIO as Socket.IO
    participant DEV as Gateway

    UI->>API: action ON or OFF
    API->>CMD: Create command record
    API->>SIO: device:command
    DEV->>API: POST /api/ingest/command-ack
    API->>CMD: ACKNOWLEDGED or FAILED
    API->>SIO: device:command result
```

30s timeout if no acknowledgment.

---

## Flow 7: Scheduled tasks

```mermaid
flowchart LR
    CRON[node-cron schedulerService] --> TASK[ScheduledTask due]
    TASK --> SW[PATCH device switch]
    TASK --> LOG[ScheduleExecutionLog]
    TASK --> SIO[device:switch org event]
```

---

## Flow 8: CI/CD deploy (CapRover)

```mermaid
flowchart LR
    GIT[Git push main] --> GHA[GitHub Actions]
    GHA -->|ems-backend changed| PACK_B[pack-backend.sh]
    GHA -->|web_frontend changed| PACK_F[pack-frontend.sh]
    PACK_B --> CAP[CapRover CLI deploy]
    PACK_F --> CAP
    CAP --> VPS[VPS Docker apps]
```

Separate workflows — backend and frontend deploy independently.

---

## Data retention & performance notes

- **Hot path:** Redis caches latest variable values per device; optional skip of Postgres `currentValue` on ingest (`SKIP_PG_CURRENT_VALUE`).
- **Flush:** `valueFlushService` periodically writes Redis → `DeviceConfigVariable.currentValue`.
- **TimescaleDB:** Optional hypertable scripts in `ems-backend/timescaledb-install/` for time-series at scale.
- **Health:** `GET /health` reports `redis` connectivity and `ingestMode` (`queued` vs `sync`).

---

## Related documents

- [Architecture](./02-architecture.md) — component diagram and security model
- [Application functionality](./04-application-functionality.md) — page-by-page features
- [Backend](./05-backend.md) — API reference summary
- [Deployment](./07-deployment-guide.md) — production hosting
