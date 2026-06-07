# Phase 9 Ops Pack

## Docker Truth Table (UI Smoke & DetectDB)

| Service Name   | Docker Compose Env          | Host Port | Container Port | Required For                   |
| :------------- | :-------------------------- | :-------- | :------------- | :----------------------------- |
| **MariaDB**    | `mariadb-innomcp` (mariadb) | `3308`    | `3306`         | Phase 9.3 DetectDB Real + Seed |
| **Frontend**   | `innomcp-next`              | `3000`    | `3000`         | UI Smoke Test                  |
| **Backend**    | `innomcp-node`              | `3011`    | `3011`         | UI Smoke Test                  |
| **MCP Server** | `innova-bot`                | `3012`    | `3012`         | UI Smoke Test                  |

_Note: If multiple MariaDB containers are running, the authoritative one is `mariadb-innomcp` (from `mariadb/docker-compose.yml`) mapped to Host Port `3308`._

### Port Cleanup Commands (Windows)

If you encounter "Port already in use" errors, use these deterministic fallback commands in PowerShell (as Administrator) to free the ports:

```powershell
# Free Frontend (3000)
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }

# Free Backend (3011)
Get-NetTCPConnection -LocalPort 3011 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }

# Free MCP (3012)
Get-NetTCPConnection -LocalPort 3012 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }

# Free MariaDB Host Port (3308)
Get-NetTCPConnection -LocalPort 3308 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

## Patch-pack Addendum for Phase 10.1

**Objective:** Strict Weather Output Mapping

- **Enforce weatherPayload schema:** The output schema must strictly validate against `weatherPayload` types.
- **No Hallucination:** If the API returns missing metrics, the system must emit `null` or explicit fallback strings instead of guessing.
- **Map Output Contract:** All fields must adhere to the exact structure required by the MCP_TOOL_INTERFACE.
