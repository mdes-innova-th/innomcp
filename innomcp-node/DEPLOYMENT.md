# INNOMCP Deployment Guide

## Prerequisites

1. Docker + Docker Compose installed
2. Create the external network (one-time):
   ```
   docker network create innomcp_network
   ```
3. Copy `.env.example` to `.env` and fill in secrets
4. MariaDB container running on `innomcp_network`

## Deploy

```bash
cp .env.example .env   # fill in secrets
docker-compose up -d
```

Access at: **http://localhost**

## Services

| Service  | Internal Port | Description          |
|----------|--------------|----------------------|
| backend  | 3011         | Node.js API          |
| frontend | 3000         | Next.js UI           |
| nginx    | 80 (public)  | Reverse proxy        |

## Required Environment Variables (.env)

```
SERVER_PORT=3011
DB_HOST=mariadb
DB_PASSWORD=<mariadb jlapps password>
MARIADB_ROOT_PASSWORD=<root password>
MARIADB_PASSWORD=<jlapps password>
TMD_UID_API=<TMD API uid>
TMD_UKEY_API=<TMD API key>
NWP_API_KEY=<NWP JWT token>
OLLAMA_API_KEY=<MDES Ollama key>
```

## Teardown

```bash
docker-compose down
```

## Troubleshooting

- "network innomcp_network declared as external, but could not be found" → run: `docker network create innomcp_network`
- Backend health failing → check `DB_HOST`/`DB_PORT` in `.env`
- Frontend 502 → nginx started before frontend was ready; run: `docker-compose restart nginx`
