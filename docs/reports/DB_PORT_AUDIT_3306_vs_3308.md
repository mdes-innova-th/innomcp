# DB Port Audit: 3306 vs 3308 (AppDB / DetectDB)

## Summary
- **3306** is the **container/internal** MariaDB port (Docker network).
- **3308** is the **host-published** port used when the app runs on the host (Windows) and MariaDB runs in Docker.

## Why 3308 exists
On developer machines, `3306` is commonly already used by another MySQL/MariaDB instance. Publishing MariaDB on **host port 3308** avoids collisions while keeping the database listening on the standard **container port 3306**.

## Deterministic networking rules
### When the app runs on the host (recommended for dev)
- App connects to DB via **localhost:3308** (Docker published port).

### When the app runs inside Docker (compose)
- App connects to DB via **mariadb:3306** (Docker service DNS + container port).

This repo enforces docker-mode DB host/port via `*-service/docker-compose.yml` environment overrides, so the same `.env` can be host-friendly without breaking container mode.

## DB connection code paths (by service)
### innomcp-node (backend)
- App DB (auth/users/etc): `innomcp-node/src/utils/db.ts`
- Detect/Evidence DB (machines/nip/record): `innomcp-node/src/utils/db/evidenceConnection.ts`

### innomcp-server-node (MCP server)
- App/knowledge DB: `innomcp-server-node/src/utils/db.ts`
- Detect DB (machines/nip/record): `innomcp-server-node/src/utils/dbDetect.ts`

### innomcp-next (Next.js)
- App DB usage: `innomcp-next/src/app/lib/db.ts` and related routes under `innomcp-next/src/app/api/**`

## Default port behavior
- Most DB clients default to **3306** when a DB port is not explicitly configured.
- Local dev uses host port **3308** only because Docker publishes MariaDB there.

## Verification commands
1) **Check container port mapping**
- `docker compose -f mariadb/docker-compose.yml port mariadb 3306`

2) **Check app effective DB port configuration (masked; ports only)**
- `node scripts/audit_db_ports.js`

## Proof snippet (no secrets)
- From `mariadb/docker-compose.yml`:
  - `- "3308:3306"`

- From `node scripts/audit_db_ports.js` (example line):
  - `mariadb.compose.ports host=3308 container=3306`
