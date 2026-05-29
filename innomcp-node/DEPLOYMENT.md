# INNOMCP Deployment Guide

## Prerequisites

- Docker + Docker Compose installed
- External `innomcp_network` created: `docker network create innomcp_network`
- MariaDB container running on `innomcp_network`

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
