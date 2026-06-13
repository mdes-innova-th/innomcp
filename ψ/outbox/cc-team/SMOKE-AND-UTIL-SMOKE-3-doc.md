<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: SMOKE-3 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":42,"completion_tokens":3571,"total_tokens":3613,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3241,"image_tokens":0},"cache_creation_input_tokens":0} | 66s
 generated: 2026-06-13T05:28:54.171Z -->
# Smoke Tests

## How to Run
Execute the smoke test suite from the project root directory. Ensure your local development server and database are running (`npm start` and `npm run db:start`) before executing:

```bash
npm run test:smoke
```

## Test Suite Overview

| Test Name | Verifies | Expected Output |
| :--- | :--- | :--- |
| `health-check` | API server responsiveness and active database connectivity. | Returns HTTP `200 OK` with JSON `{"status": "healthy"}`. |
| `auth-login` | Core user authentication flow and secure JWT generation. | Returns HTTP `200 OK` containing a valid `token` string. |
| `static-assets` | Frontend build integrity, routing, and static asset serving. | Returns HTTP `200 OK` for `index.html` and primary JS/CSS bundles. |
| `db-migrations` | Database schema is fully up-to-date and properly seeded. | Console outputs `Migrations up to date` with zero pending tasks. |

## Troubleshooting
If any tests fail, inspect the `logs/smoke-test.log` file for detailed stack traces, error codes, and timestamps. Common failures typically stem from missing environment variables in your local `.env` file, port conflicts, or an uninitialized local database. Run `npm run db:setup` to resolve schema issues, clear your Redis cache with `npm run cache:clear`, and then re-run the smoke tests to confirm overall system stability before deploying.
