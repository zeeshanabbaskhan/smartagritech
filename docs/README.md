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
| 8 | [Database architecture](./08-database-architecture.md) | ER diagrams, all tables, keys, indexes, Redis, data flows |
| 9 | [CF features implementation](./09-cf-features-implementation.md) | Custom dashboards, access/device groups, facilities, power flow — frontend & backend detail |
| 10 | [CF features E2E test guide](./10-cf-features-e2e-test-guide.md) | End-to-end manual QA checklist for all CF features |

## PDF exports

Formatted PDFs (A4, headers/footers, Mermaid diagrams rendered) live in [`pdf/`](./pdf/):

| PDF | Source |
|-----|--------|
| [README.pdf](./pdf/README.pdf) | Index |
| [01-system-overview-and-flows.pdf](./pdf/01-system-overview-and-flows.pdf) | Flows |
| [02-architecture.pdf](./pdf/02-architecture.pdf) | Architecture |
| [03-tech-stack.pdf](./pdf/03-tech-stack.pdf) | Tech stack |
| [04-application-functionality.pdf](./pdf/04-application-functionality.pdf) | Functionality |
| [05-backend.pdf](./pdf/05-backend.pdf) | Backend |
| [06-web-frontend.pdf](./pdf/06-web-frontend.pdf) | Web frontend |
| [07-deployment-guide.pdf](./pdf/07-deployment-guide.pdf) | Deployment |
| [08-database-architecture.pdf](./pdf/08-database-architecture.pdf) | Database |
| [09-cf-features-implementation.pdf](./pdf/09-cf-features-implementation.pdf) | CF features (frontend & backend) |
| [10-cf-features-e2e-test-guide.pdf](./pdf/10-cf-features-e2e-test-guide.pdf) | CF features E2E test guide |
| [OPTIMIZATION_GUIDE.pdf](./pdf/OPTIMIZATION_GUIDE.pdf) | Root `OPTIMIZATION_GUIDE.md` |

Regenerate after editing Markdown:

```bash
cd docs && npm install && node convert-to-pdf.js
```

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
