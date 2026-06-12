<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-12 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":50,"completion_tokens":623,"total_tokens":673,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":53,"image_tokens":0},"cache_creation_input_tokens":0} | 9s
 generated: 2026-06-12T03:49:12.831Z -->
# Security Guide

## API Key Management (Environment Variables Only)

All API keys, tokens, and other secrets **must never** be hardcoded in source code, configuration files committed to version control, or stored in any plaintext format. Instead, use environment variables exclusively. Load secrets at runtime via `process.env` (Node.js), `os.environ` (Python), or equivalent mechanisms in your framework. Create a `.env.example` file listing required variables with dummy values, and ensure `.env` is added to `.gitignore`. Regularly rotate keys and audit access.

## Prohibition on Hardcoded Secrets

Hardcoding secrets—passwords, database credentials, OAuth tokens, or encryption keys—exposes them in code reviews, logs, and repository history. Enforce automated scanning with tools like `git-secrets`, `truffleHog`, or pre-commit hooks to detect accidental commits. Use vault solutions (e.g., HashiCorp Vault, AWS Secrets Manager) for production environments, but always fall back to environment variables for development and CI/CD.

## CORS Configuration

Restrict Cross-Origin Resource Sharing to only trusted origins. In production, never use `Access-Control-Allow-Origin: *`. Instead, specify an explicit, validated list of allowed origins (e.g., `https://app.example.com`). Validate the `Origin` header server-side and reflect it only if it matches an allowed pattern. Set appropriate methods (`GET`, `POST`, etc.) and headers. Avoid exposing credentials unless absolutely necessary, and if needed, require `Access-Control-Allow-Credentials: true` with a specific origin (no wildcards).

## Rate Limiting Setup

Implement rate limiting to prevent abuse, brute‑force attacks, and resource exhaustion. Use a sliding window or token bucket algorithm. Apply limits at the API gateway, reverse proxy (e.g., Nginx `limit_req`), or application middleware (e.g., `express-rate-limit`). Set sensible thresholds per endpoint (e.g., 100 requests/minute for public endpoints, lower for login). Return HTTP `429 Too Many Requests` with a `Retry-After` header. Log rate limit events for monitoring.

## Session Security Guidelines

- Use secure, HTTP-only, and SameSite cookies (set `Secure`, `HttpOnly`, `SameSite=Strict`).
- Regenerate session IDs after login, logout, or privilege escalation.
- Set short expiration times; implement idle timeouts (e.g., 15 minutes) and absolute session lifetimes (e.g., 8 hours).
- Store sessions server-side (e.g., Redis) with a random, unguessable token. Avoid client-side session storage.
- Rotate secrets used for session signing/encryption regularly.
