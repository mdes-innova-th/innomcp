<!-- cc-team deliverable
 group: G2 (component division)
 member: COMP-041 role=frontend model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1942,"completion_tokens":2343,"total_tokens":4285,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1778,"image_tokens":0},"cache_creation_input_tokens":0} | 33s
 generated: 2026-06-13T12:14:23.957Z -->
| severity | location | issue | fix |
|----------|----------|-------|-----|
| High | `POST` – user insertion + API key creation | No transaction wrapping user creation and API key generation. If API key creation fails and the compensating `DELETE` also fails, an orphan user row remains in the database. | Use a database transaction: `beginTransaction`, insert user, create API key, commit on success, rollback on any failure. |
| High | Username/email existence checks | User enumeration vulnerability – distinct error messages for existing username/email leak valid accounts. | Return a generic error like “Registration failed. Please try again.” and log the specifics server‑side only. |
| High | `mysql.createConnection` | A new database connection is created (and closed) for every request, leading to connection exhaustion and poor performance under load. | Use a connection pool (`mysql2.createPool`) instantiated once at module level. |
| High | Entire route handler | No rate limiting applied, leaving the endpoint open to brute‑force and denial‑of‑service attacks. | Add a rate‑limiting middleware (e.g., using Redis‑based strategies) to limit requests per IP / user. |
| Medium | Input validation | No maximum length constraints on `username`, `user_dispname`, `user_email`, `user_phone`, or `password`. Maliciously long input could cause performance issues or storage overflow. | Add maximum length checks (e.g., 255 characters) for each field and reject oversized requests with a 400 status. |
| Medium | Environment configuration | `process.env.DB_HOST`, `DB_PORT`, etc., are used without verifying they exist. Missing variables produce opaque runtime errors. | Validate all required environment variables at startup and throw a clear error if any are undefined. |
| Medium | JWT authentication (`jwtMiddleware`) | If the JWT is stored in a cookie, the endpoint may be vulnerable to Cross‑Site Request Forgery (CSRF). | Enforce CSRF protection (e.g., `SameSite=Strict`/`Lax` plus a CSRF token) or require Authorization header with bearer tokens. |
| Low | API key response | The newly created API key is sent in the response body. While acceptable for registration, it could be exposed in logs or browser history. | Advise the client to save the key immediately and avoid logging the full key. Optionally display it only once and offer a secure download. |
| Low | Error handling | `console.error` logs the error message directly. In production, this may leak sensitive stack traces or database details. | Use a structured logger and sanitise error output, logging only safe messages and error codes in production. |
