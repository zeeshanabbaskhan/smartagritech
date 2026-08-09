# Production operations (Smart AgriTech EMS)

Operational runbooks for the **live** Docker Compose stack — grounded in this repo’s Prisma schema, `deploy/docker-compose.yml`, and known production layout.

## Production snapshot

| Item | Value |
|------|--------|
| Host | `51.38.88.130` |
| Deploy path | `/opt/smartagritech` |
| Compose file | `/opt/smartagritech/docker-compose.yml` (from `deploy/docker-compose.yml`) |
| Env file | `/opt/smartagritech/.env` (never commit; secrets live here) |
| Frontend | host port **8080** → container `:80` |
| Backend | host port **9001** → container `:9001` |
| Health | `GET http://127.0.0.1:9001/health` |
| Postgres | Docker service `postgres` (project container usually `smartagritech-postgres-1`) when using bundled DB |
| Redis | Host Redis via `REDIS_URL=redis://host.docker.internal:6379` **or** bundled `redis` profile |
| MQTT | In-process bridges (`mqtt_bridges` table) + optional legacy `/opt/mqtt/mqtt_to_http.log` |

Typical container names (Compose project name = directory `smartagritech`):

- `smartagritech-backend-1`
- `smartagritech-frontend-1`
- `smartagritech-postgres-1` (if postgres is running in Compose)
- `smartagritech-redis-1` (only with `--profile bundled-db`)

Confirm with: `cd /opt/smartagritech && docker compose ps`

## Docs in this folder

| Doc | When to use |
|-----|-------------|
| [backend-down-troubleshooting.md](./backend-down-troubleshooting.md) | API down / unhealthy / restart loops |
| [disk-space.md](./disk-space.md) | Disk full, growers, prune strategy |
| [wipe-sensor-data.md](./wipe-sensor-data.md) | Wipe all telemetry or until a datetime |
| [logs.md](./logs.md) | Backend / frontend Compose logs |
| [database-access.md](./database-access.md) | `psql` into EMS Postgres |
| [sql-queries.md](./sql-queries.md) | Ready-to-run SQL catalog |
| [mqtt-live-data.md](./mqtt-live-data.md) | Verify live ingest / Redis / bridges |

## Related repo paths

| Path | Role |
|------|------|
| `ems/ems-backend/prisma/schema.prisma` | Canonical table/column names |
| `deploy/docker-compose.yml` | Production Compose template |
| `deploy/linux.env.example` | Env var reference (no secrets) |
| `scripts/ops/wipe-sensor-data-*.sh` | Telemetry wipe scripts |
| `scripts/deploy/clear-sensor-data.sh` | Older one-shot truncate helper |
| `scripts/deploy/remote-up.sh` | Tarball deploy + disk prune |

## Getting scripts onto the server

**Preferred — git pull clone:**

```bash
ssh USER@51.38.88.130
cd /tmp
git clone --depth 1 --branch main https://github.com/zeeshanabbaskhan/smartagritech.git smartagritech-src
# or: git -C /tmp/smartagritech-src pull
sudo mkdir -p /opt/smartagritech/scripts/ops
sudo cp /tmp/smartagritech-src/scripts/ops/*.sh /opt/smartagritech/scripts/ops/
sudo chmod +x /opt/smartagritech/scripts/ops/*.sh
```

**Or scp from your Windows machine (PowerShell):**

```powershell
scp scripts/ops/*.sh USER@51.38.88.130:/tmp/
# then on server: sudo cp /tmp/wipe-sensor-data-*.sh /opt/smartagritech/scripts/ops/ ; sudo chmod +x ...
```

## Safety rules

- Do **not** put real passwords in tickets or docs — read `DATABASE_URL` / `POSTGRES_PASSWORD` from `/opt/smartagritech/.env` on the server only.
- Wipe scripts require `--yes`.
- Prefer wiping telemetry tables only; leave orgs, users, devices, templates, MQTT bridges intact (see wipe doc).
