# Database access (production)

EMS Postgres for this stack is typically the Compose service **`postgres`**, container name **`smartagritech-postgres-1`**, database/user **`ems`** (from `POSTGRES_USER` / `POSTGRES_DB` in `/opt/smartagritech/.env`).

Do **not** paste real passwords into tickets, chat, or git. Read secrets only on the server from `.env`.

## Open interactive `psql`

```bash
ssh USER@51.38.88.130
docker exec -it smartagritech-postgres-1 psql -U ems -d ems
```

One-shot query:

```bash
docker exec smartagritech-postgres-1 psql -U ems -d ems -c 'SELECT COUNT(*) FROM devices;'
```

Multi-line SQL from a file on the host:

```bash
docker exec -i smartagritech-postgres-1 psql -U ems -d ems < /tmp/query.sql
```

## Connection notes

| Setting | Typical production value |
|---------|---------------------------|
| Container | `smartagritech-postgres-1` |
| User | `ems` (or `$POSTGRES_USER`) |
| Database | `ems` (or `$POSTGRES_DB`) |
| In-container auth | `psql -U ems` usually works without prompting |
| Backend `DATABASE_URL` | Set in `/opt/smartagritech/.env` — **password lives there** |

Inspect URL **shape** without printing the password:

```bash
cd /opt/smartagritech
# Shows host/db only (strips userinfo)
grep '^DATABASE_URL=' .env | sed -E 's#(postgresql://)[^@]+@#\1***:***@#'
```

If Compose uses **host** Postgres instead of the container (`host.docker.internal:5432` per `deploy/linux.env.example`), connect with host `psql` using credentials from `DATABASE_URL` — still do not log the password:

```bash
# Example pattern only — substitute from .env yourself on the server
psql "postgresql://ems:PASSWORD_FROM_ENV@127.0.0.1:5432/ems"
```

## Confirm which DB the backend uses

```bash
cd /opt/smartagritech
docker compose exec backend printenv DATABASE_URL | sed -E 's#(postgresql://)[^@]+@#\1***:***@#'
docker compose exec backend printenv REDIS_URL
```

## Useful `\psql` meta

```text
\conninfo
\dt
\d+ sensor_readings
\d+ sensor_reading_values
\timing on
```

## Ready-made queries

See [sql-queries.md](./sql-queries.md).

## Backups (ops reminder)

```bash
# Logical dump (run on server; store off-box)
docker exec smartagritech-postgres-1 pg_dump -U ems -d ems -Fc -f /tmp/ems.dump
docker cp smartagritech-postgres-1:/tmp/ems.dump ./ems-$(date +%Y%m%d).dump
```
