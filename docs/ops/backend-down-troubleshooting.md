# Backend down — troubleshooting

Production: `51.38.88.130`, stack at `/opt/smartagritech`, API on **`:9001`**.

## Quick checks (copy-paste)

SSH in, then:

```bash
cd /opt/smartagritech
docker compose ps
curl -sS -m 5 http://127.0.0.1:9001/health ; echo
df -h /
free -h
docker compose logs --tail=200 backend
```

Healthy `/health` looks like:

```json
{"status":"ok","ts":"...","redis":true,"ingestMode":"queued"}
```

(`redis:false` / `ingestMode:"sync"` means Redis is unreachable — API may still answer, but batch ingest/queues degrade.)

## 1. Are containers running?

```bash
cd /opt/smartagritech
docker compose ps
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Expect `smartagritech-backend-1` **Up** (ideally healthy). Frontend is `smartagritech-frontend-1` on `:8080`.

If backend is **Restarting** / **Exited**:

```bash
docker compose logs --tail=300 backend
docker inspect smartagritech-backend-1 --format '{{.State.Status}} {{.State.ExitCode}} {{.State.OOMKilled}}'
```

`OOMKilled=true` → raise host RAM or lower `INGEST_WORKER_CONCURRENCY` / `DB_POOL_MAX` in `.env`, then restart.

## 2. Health endpoint from the host

```bash
curl -sS -m 5 http://127.0.0.1:9001/health
curl -sS -m 5 http://127.0.0.1:9001/metrics | head
```

From outside (if firewall allows): `http://51.38.88.130:9001/health`.

| Symptom | Likely cause |
|---------|----------------|
| Connection refused | Container down / wrong port / bind failed |
| Hang / timeout | Event loop stuck, DB pool exhausted, disk full |
| HTTP 5xx | App error — check logs |
| `status":"ok"` but UI broken | Frontend / CORS / `CLIENT_URL` / wrong `VITE_API_URL` build |

## 3. Compose logs

```bash
cd /opt/smartagritech
docker compose logs --tail=500 backend
docker compose logs -f --tail=100 backend   # follow
```

Useful greps:

```bash
docker compose logs --tail=2000 backend 2>&1 | grep -Ei 'error|fatal|ECONNREFUSED|timeout|migrate|OOM|ENOSPC|redis|prisma'
```

## 4. Postgres

Production historically uses Compose postgres (`smartagritech-postgres-1`). Confirm:

```bash
docker ps | grep -i postgres
docker exec smartagritech-postgres-1 pg_isready -U ems -d ems
```

Interactive SQL (password not needed for local peer/trust inside container when using `-U ems`):

```bash
docker exec -it smartagritech-postgres-1 psql -U ems -d ems -c 'SELECT 1;'
```

If backend `.env` points at **host** Postgres (`host.docker.internal:5432`), also check:

```bash
# on host
ss -ltnp | grep 5432 || netstat -ltnp | grep 5432
# from backend container
docker exec smartagritech-backend-1 node -e "const{Client}=require('pg');const u=process.env.DATABASE_URL;const c=new Client({connectionString:u});c.connect().then(()=>c.query('select 1')).then(r=>{console.log(r.rows);return c.end()}).catch(e=>{console.error(e);process.exit(1)})"
```

Do not print `DATABASE_URL` into chat logs — it contains the password.

## 5. Redis

Health JSON `"redis": true` means the backend client connected.

```bash
# Host Redis (recommended in linux.env.example)
redis-cli -u "${REDIS_URL:-redis://127.0.0.1:6379}" ping
# or bundled
docker exec smartagritech-redis-1 redis-cli ping
```

If Redis is down: ingest falls back to sync mode; rate limits / BullMQ / latest-value cache suffer. Fix Redis, then `docker compose restart backend`.

## 6. Disk full

```bash
df -h /
df -i /
docker system df
```

`ENOSPC` / migrate failures / unexplained restarts often mean **disk full**. See [disk-space.md](./disk-space.md). Largest historical offender: `sensor_readings` + `sensor_reading_values`.

Deploy script also notes `/opt/mqtt/mqtt_to_http.log` can grow multi‑GB:

```bash
ls -lh /opt/mqtt/mqtt_to_http.log 2>/dev/null || true
# if huge and safe to clear:
# truncate -s 0 /opt/mqtt/mqtt_to_http.log
```

## 7. OOM / memory pressure

```bash
free -h
dmesg -T | grep -i 'killed process' | tail
docker stats --no-stream
```

## 8. Schema / migrate failures on start

Backend runs `ensureSchemaOnStart` (CF features + MQTT bridge SQL; optional Timescale). Failures appear early in logs:

```bash
docker compose logs --tail=400 backend 2>&1 | grep -Ei 'schema|migrate|ENSURE_|prisma|CF schema|mqtt bridge schema'
```

Manual Prisma migrate (only if you intentionally deploy migrations — prefer known good image):

```bash
cd /opt/smartagritech
docker compose exec backend npx prisma migrate status
# Do not run migrate deploy casually on prod without a backup.
```

## Restart / recover

Minimal restart:

```bash
cd /opt/smartagritech
docker compose restart backend
sleep 8
curl -sS -m 8 http://127.0.0.1:9001/health ; echo
docker compose ps
```

Rebuild if code/image is bad:

```bash
cd /opt/smartagritech
docker compose up -d --build --remove-orphans backend
```

Postgres + backend after a wipe or heavy VACUUM:

```bash
cd /opt/smartagritech
docker compose restart postgres backend
```

## After recovery — smoke

```bash
curl -sS http://127.0.0.1:9001/health
# UI
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/
# Live data checklist → mqtt-live-data.md
```
