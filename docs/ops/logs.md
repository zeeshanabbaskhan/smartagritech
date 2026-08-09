# Logs (production)

Stack: `/opt/smartagritech` · Compose project containers typically `smartagritech-backend-1` / `smartagritech-frontend-1`.

## Backend logs

```bash
cd /opt/smartagritech

# Last N lines
docker compose logs --tail=200 backend

# Follow
docker compose logs -f --tail=100 backend

# Since timestamp
docker compose logs --since=30m backend
docker compose logs --since=2026-08-09T00:00:00 backend

# By container name
docker logs --tail=200 smartagritech-backend-1
docker logs -f --tail=100 smartagritech-backend-1
```

### Useful greps

```bash
docker compose logs --tail=3000 backend 2>&1 | grep -Ei 'error|fatal|unhandled|ECONNREFUSED|timeout'
docker compose logs --tail=3000 backend 2>&1 | grep -Ei 'mqtt bridge|no matching device|non-JSON'
docker compose logs --tail=3000 backend 2>&1 | grep -Ei 'ingest|prisma|redis|ENOSPC|OOM'
docker compose logs --tail=3000 backend 2>&1 | grep -Ei 'schema ensure|Timescale|CF schema'
```

Backend logger is structured (via `utils/logger`). Startup mentions Redis / ingest mode (`queued` vs `sync`).

## Frontend logs

Nginx (or static server) inside the frontend image — mostly access / start errors:

```bash
cd /opt/smartagritech
docker compose logs --tail=200 frontend
docker logs --tail=200 smartagritech-frontend-1
```

UI build-time API host is baked into the image (`VITE_API_URL`). Wrong host → browser console errors, not useful server logs.

## Postgres / Redis logs

```bash
docker compose logs --tail=200 postgres   # if bundled-db profile running
docker compose logs --tail=200 redis
```

## Legacy MQTT bridge file log

`scripts/deploy/remote-up.sh` truncates this during deploy if present:

```bash
ls -lh /opt/mqtt/mqtt_to_http.log 2>/dev/null
tail -n 100 /opt/mqtt/mqtt_to_http.log
```

Prefer in-app **MQTT bridges** (`mqtt_bridges` table + backend logs) for current production.

## Export a log bundle

```bash
cd /tmp
docker compose -f /opt/smartagritech/docker-compose.yml logs --no-color --tail=5000 backend > be.log
docker compose -f /opt/smartagritech/docker-compose.yml logs --no-color --tail=1000 frontend > fe.log
tar -czf ems-logs-$(date +%Y%m%d%H%M).tgz be.log fe.log
```
