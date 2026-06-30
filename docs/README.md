# Smart AgriTech EMS — Documentation

Energy & IoT Management System (EMS) for organizations that monitor field devices, gateways, sensor telemetry, alarms, and analytics.

## Documentation index

| # | Document | Description |
|---|----------|-------------|
| 1 | [System overview & flows](./01-system-overview-and-flows.md) | End-to-end journeys, roles, device lifecycle, ingest, alarms |
| 2 | [Architecture](./02-architecture.md) | Components, data stores, deployment topology, security |
| 3 | [Tech stack](./03-tech-stack.md) | Languages, frameworks, infrastructure choices |
| 4 | [Application functionality](./04-application-functionality.md) | Feature catalog by role with diagrams |
| 5 | [Backend](./05-backend.md) | API, services, workers, database, ingest pipeline |
| 6 | [Web frontend](./06-web-frontend.md) | Routes, pages, state, real-time UI flows |
| 7 | [Deployment guide](./07-deployment-guide.md) | CapRover, VPS options, pricing, CI/CD |

## Repository layout

```
smartagritechapp/
├── ems/ems-backend/     # Node.js API (Express + Prisma + PostgreSQL)
├── web_frontend/        # React dashboard (Vite + Tailwind)
├── app/                 # Flutter mobile app (companion client)
├── scripts/             # CapRover pack scripts, device simulator, fleet seed
├── deploy/              # Production env examples
├── .github/workflows/   # CapRover auto-deploy (backend + frontend)
├── script.py            # Optional MQTT → HTTP ingest bridge
└── docs/                # This documentation set
```

## Quick start (local development)

```bash
# Backend
cd ems/ems-backend && npm install
cp .env.example .env   # set DATABASE_URL, JWT_SECRET, REDIS_URL
npx prisma migrate deploy && npm run seed
npm run dev            # http://localhost:5000

# Web frontend
cd web_frontend && npm install && npm run dev   # http://localhost:5173

# Optional: device simulator
cd ems/ems-backend && npm run simulate:production
```

Default seeded users: `superadmin@ems.com`, `orgadmin@ems.com`, `user@ems.com` (password `Admin@123456`).

## Production deployment (summary)

Recommended path: **VPS + CapRover** with four apps (`iotpostgres`, `iotredis`, `iotbackend`, `iotfrontend`). See [Deployment guide](./07-deployment-guide.md).

GitHub Actions deploy backend and frontend independently when their folders change on `main`/`master`.
