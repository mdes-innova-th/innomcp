<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-13 role=doc model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":51,"completion_tokens":2205,"total_tokens":2256,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1556,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 24s
 generated: 2026-06-12T03:49:30.136Z -->
# Production Deployment Guide

## Prerequisites

- Node.js LTS (18.x or 20.x)
- PM2 installed globally (`npm i -g pm2`)
- Access to the production database and secrets store

## Build Steps

1. Pull the release tag and ensure a clean working directory.
2. Install dependencies: `npm ci --omit=dev`
3. Compile the application: `npm run build`
4. Prune unnecessary dependencies: `npm prune --production`
5. Verify the `dist/` directory contains the compiled server and static assets.

## Environment Variables

Load the following variables via your secrets manager or a `.env` file:

| Variable | Description | Required |
|---|---|---|
| `NODE_ENV` | Must be set to `production` | Yes |
| `PORT` | TCP port exposed to the load balancer | Yes |
| `DATABASE_URL` | Production database connection string | Yes |
| `LOG_LEVEL` | Logging verbosity (`info`, `warn`, `error`) | No |
| `TRUST_PROXY` | Trust `X-Forwarded-*` headers when behind a reverse proxy | No |

## Health Check Endpoint

Use a dedicated `/health` (or `/ready`) endpoint for load balancer and orchestrator probes:

```bash
curl -f http://localhost:${PORT}/health || exit 1
```

The endpoint must return `200 OK` only when the application and its critical dependencies are responsive. Return `503 Service Unavailable` if the database or another required service is unreachable. Configure probes with a 30-second interval and a 5-second timeout so traffic is routed away from failing instances.

## Graceful Shutdown

Implement signal handlers to drain in-flight requests without dropping connections:

1. Stop accepting new connections (`server.close()`).
2. Allow active requests to finish within the grace period.
3. Disconnect from the database and external services.
4. Exit with code `0`.

Example implementation:

```javascript
process.on('SIGTERM', async () => {
  await server.close();
  await db.disconnect();
  process.exit(0);
});
```

Ensure the orchestrator or process manager provides at least a 5–10 second `kill_timeout` before forcing termination.

## PM2 Ecosystem Config

Create `ecosystem.config.js` in the project root:

```javascript
module.exports = {
  apps: [{
    name: 'api',
    script: './dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    kill_timeout: 8000,
    listen_timeout: 10000,
    max_restarts: 5,
    min_uptime: '10s',
    wait_ready: true
  }]
};
```

## Start

```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

Monitor runtime behavior with `pm2 logs` and `pm2 monit`.
