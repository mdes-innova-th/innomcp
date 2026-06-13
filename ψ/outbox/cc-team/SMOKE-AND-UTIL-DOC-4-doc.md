<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: DOC-4 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":43,"completion_tokens":965,"total_tokens":1008,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":332,"image_tokens":0},"cache_creation_input_tokens":0} | 11s
 generated: 2026-06-13T05:28:53.024Z -->
# Environment Variables

## innomcp-node

| Variable | Default | Required | What Breaks If Missing |
|----------|---------|----------|------------------------|
| `PORT` | `3001` | No | Server fails to start if port is in use; logs warning with fallback |
| `HOST` | `0.0.0.0` | No | Server binds to all interfaces; missing causes binding failure on some systems |
| `LOG_LEVEL` | `info` | No | Logging defaults to `info`; missing might degrade debugging |
| `MCP_SERVER_URL` | `http://localhost:3000` | Yes | MCP client cannot connect; API calls error |
| `MCP_API_KEY` | – | Required | Authentication fails; server returns 401 |
| `DATABASE_URL` | `sqlite://./data.db` | Yes | Database layer crashes on startup |
| `NODE_ENV` | `development` | No | Missing defaults to `development`; reduces security defaults |
| `REDIS_URL` | – | For caching | Caching disabled; performance degrades without warning |

Missing `MCP_API_KEY` or `DATABASE_URL` causes immediate startup failure.  
Missing `MCP_SERVER_URL` results in runtime errors on first MCP call.

## innomcp-next

| Variable | Default | Required | What Breaks If Missing |
|----------|---------|----------|------------------------|
| `NEXT_PUBLIC_MCP_SERVER_URL` | `http://localhost:3001` | Yes | Frontend cannot reach MCP backend; every fetch fails |
| `NEXT_PUBLIC_APP_NAME` | `InnoMCP` | No | UI defaults to “InnoMCP”; branding is broken |
| `MCP_INTERNAL_API_KEY` | – | Required | Server-side API routes return 403 |
| `MCP_BASE_URL` | `http://innomcp-node:3001` | Yes (Docker) | Server-side calls fail in containerised setups |
| `NEXT_PUBLIC_ANALYTICS_ID` | – | No | Analytics disabled; no error |
| `NODE_ENV` | `production` | Yes | Missing causes Next.js to default to dev mode (slower, more verbose) |
| `SESSION_SECRET` | – | Required | Session handling crashes on login |

`NEXT_PUBLIC_MCP_SERVER_URL` and `MCP_INTERNAL_API_KEY` are mandatory; their absence leads to broken UI and inaccessible API routes.  
`SESSION_SECRET` missing causes a hard crash on any session-based request.

## Common Pitfalls
- Ensure `MCP_API_KEY` in innomcp-node matches `MCP_INTERNAL_API_KEY` in innomcp-next.
- For production, set `NODE_ENV` to `production` in both.
- Use `.env.local` for Next.js public variables; `.env` for server-side secrets.
