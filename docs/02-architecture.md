# Architecture

Technical architecture of the Smart AgriTech EMS platform: components, data flow, security, and deployment topology.

## Logical architecture

```mermaid
C4Context
    title EMS Platform Context

    Person(admin, "Super Admin", "Manages platform")
    Person(orgadmin, "Org Admin", "Manages org devices")
    Person(user, "Field User", "Views assigned devices")
    Person(device, "IoT Device", "Sends telemetry")

    System(ems, "EMS Platform", "Web + API + real-time")
    System_Ext(mqtt, "MQTT Broker", "Optional field protocol")
    System_Ext(email, "SMTP", "Alarm emails")

    admin --> ems
    orgadmin --> ems
    user --> ems
    device --> ems
    mqtt --> ems
    ems --> email
```

## Container diagram

```mermaid
flowchart TB
    subgraph ClientTier["Client tier"]
        WEB["web_frontend<br/>React + Vite + nginx"]
        APP["app<br/>Flutter mobile"]
    end

    subgraph AppTier["Application tier"]
        API["ems-backend<br/>Express 5 + Node 20"]
        WORKERS["BullMQ workers<br/>ingest, anomaly, email"]
        SCHED["node-cron scheduler"]
        SOCK["Socket.IO server"]
    end

    subgraph DataTier["Data tier"]
        PG[("PostgreSQL<br/>Prisma ORM")]
        REDIS[("Redis<br/>cache + queues")]
    end

    subgraph EdgeTier["Edge / optional"]
        BRIDGE["script.py<br/>MQTT bridge"]
        SIM["deviceSimulator.js"]
    end

    WEB -->|HTTPS REST| API
    WEB -->|WSS| SOCK
    APP -->|HTTPS REST| API
    API --> PG
    API --> REDIS
    WORKERS --> PG
    WORKERS --> REDIS
    SOCK --> REDIS
    API --> SOCK
    BRIDGE --> API
    SIM --> API
    SCHED --> API
```

## Backend internal layers

```mermaid
flowchart TB
    subgraph HTTP
        R[routes/]
        M[middleware/<br/>auth, rateLimit, upload]
    end

    subgraph Logic
        C[controllers/]
        S[services/]
    end

    subgraph Async
        W[workers/jobQueues.js]
        VF[valueFlushService]
    end

    subgraph Infra
        CFG[config/<br/>database, redis, mail]
        U[utils/]
        P[prisma/]
    end

    R --> M --> C --> S
    S --> P
    S --> W
    S --> VF
    C --> U
```

| Layer | Responsibility |
|-------|----------------|
| **Routes** | URL mapping, mount order (`/api/ingest` before `/api`) |
| **Middleware** | JWT `protect`, role `authorize`, rate limits, multer uploads |
| **Controllers** | Request validation, org scoping, HTTP responses |
| **Services** | Business logic: ingest, anomalies, notifications, scheduler |
| **Workers** | BullMQ: batched ingest, anomaly checks, email, device delete |
| **Prisma** | 40+ models, migrations, type-safe queries |

## Multi-tenancy model

```mermaid
erDiagram
    Organization ||--o{ User : has
    Organization ||--o{ Gateway : owns
    Organization ||--o{ Device : owns
    Organization ||--o{ DeviceTemplate : defines
    Device ||--o{ DeviceConfigSlave : provisions
    DeviceConfigSlave ||--o{ DeviceConfigVariable : contains
    Device ||--o{ SensorReading : generates
    Device }o--o{ User : "DeviceUser assignment"
    Gateway ||--o{ Device : hosts
    DeviceTemplate ||--o{ Device : templates
```

**Isolation rules:**

- `ORG_ADMIN` and `USER` queries scoped to `user.organizationId`.
- `USER` device list filtered through `DeviceUser` join.
- `SUPER_ADMIN` can query any org (optional `organizationId` filter).

## Ingest architecture (production path)

```mermaid
flowchart LR
    subgraph Ingress
        RL[deviceIngestLimiter]
        AK[ingestAuth SHA-256]
    end

    subgraph Queue
        BUF[In-memory buffer]
        BQ[BullMQ ingest queue]
        W[Workers N=4 default]
    end

    subgraph Persist
        SR[SensorReading JSON]
        SRV[SensorReadingValue rows]
        DCV[DeviceConfigVariable]
    end

    subgraph Hot
        RH["Redis HSET<br/>device:id:latest"]
        DIRTY[devices:dirty:latest]
        FLUSH[valueFlush → PG]
    end

    HTTP --> RL --> AK
    AK --> BUF --> BQ --> W
    W --> SR & SRV & DCV
    W --> RH --> DIRTY --> FLUSH
```

## Real-time architecture

```mermaid
flowchart TB
    subgraph SocketIO
        AUTH[JWT handshake.auth.token]
        ROOMS["Rooms:<br/>org_{orgId}<br/>user_{userId}<br/>device_{deviceId}"]
    end

  ING[ingestService] -->|reading:new| DROOM[device_*]
  ANOM[anomalyDetector] -->|alarm:new| OROOM[org_*]
  DEV[deviceController] -->|device:command| DROOM
  SCHED[schedulerService] -->|device:switch| OROOM

    CLIENT[Web client] -->|join:device| DROOM
    AUTH --> ROOMS
```

Optional **Redis adapter** (`@socket.io/redis-adapter`) enables horizontal scaling of API instances.

## Web frontend architecture

```mermaid
flowchart TB
    subgraph Providers
        T[ThemeProvider]
        A[AuthProvider]
        TO[ToastProvider]
        D[DeviceProvider]
    end

    subgraph UI
        L[DashboardLayout + Sidebar]
        P[Pages admin/org/user]
        SH[Shared pages]
    end

    subgraph Data
        API[emsApi.js]
        SOCK[socketService.js]
        MAP[mappers.js]
    end

    T --> A --> TO --> D --> L --> P
    P --> SH
    P --> API
    P --> SOCK
    API --> MAP
```

Build output: static SPA served by **nginx** (Docker) with API URL baked at build time (`VITE_API_URL`, `VITE_SOCKET_URL`).

## Mobile app (Flutter)

Located in `app/` — companion client for the same REST API:

- Auth, device list, dashboards (role-aligned with backend).
- Shares backend JWT auth model.
- Deployed separately (Android/iOS builds), not part of CapRover web stack.

## Security architecture

| Concern | Implementation |
|---------|----------------|
| Authentication | JWT access (15m default) + refresh tokens (hashed in DB) |
| Authorization | Role middleware + per-controller org/device checks |
| Ingest auth | `x-api-key` header — global `INGEST_API_KEY` or per-device hashed key |
| Rate limiting | `express-rate-limit` + Redis store when available |
| CORS | `CLIENT_URL` comma-separated origins |
| Cookies | Optional httpOnly token cookies in auth flow |
| Helmet | Security headers on API |
| Uploads | Cloudinary for icons/products (optional) |

```mermaid
flowchart LR
    REQ[Request] --> TYPE{Path?}
    TYPE -->|/api/ingest| KEY[x-api-key]
    TYPE -->|/api/*| JWT[Bearer JWT]
    TYPE -->|/socket.io| STOKEN[handshake token]
    KEY --> OK[Handler]
    JWT --> OK
    STOKEN --> OK
```

## Production deployment topology (CapRover)

```mermaid
flowchart TB
    subgraph Internet
        USER[Users / devices]
    end

    subgraph VPS["VPS single node or cluster"]
        CAP[CapRover reverse proxy<br/>HTTPS Let's Encrypt]
        FE[iotfrontend nginx :80]
        BE[iotbackend Node :9001]
        PG[iotpostgres]
        RD[iotredis]
    end

    USER -->|HTTPS| CAP
    CAP --> FE
    CAP --> BE
    BE --> PG
    BE --> RD
    USER -->|HTTPS /api/ingest| CAP
```

Internal DNS (CapRover): `srv-captain--{appName}` for service-to-service URLs.

## Observability

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness: DB, Redis, ingest mode |
| `GET /metrics` | Prometheus text format counters |
| App logs | Docker/CapRover container logs |
| Prisma logs | Opt-in `PRISMA_LOG_QUERIES=true` |

## Scalability considerations

| Bottleneck | Mitigation |
|------------|------------|
| High ingest rate | Redis + BullMQ batching; increase `INGEST_WORKER_CONCURRENCY` |
| Dashboard reads | Redis latest cache; `SKIP_PG_CURRENT_VALUE`; response cache on dashboard summary |
| Socket fan-out | Redis Socket.IO adapter; multiple backend replicas behind CapRover |
| Time-series growth | TimescaleDB hypertables; archive scripts in `scripts/archive-cold-data` |
| DB connections | PgBouncer (documented in `.env.example`); pool tuning `DB_POOL_*` |

## Related documents

- [System flows](./01-system-overview-and-flows.md)
- [Tech stack](./03-tech-stack.md)
- [Backend details](./05-backend.md)
- [Deployment](./07-deployment-guide.md)
