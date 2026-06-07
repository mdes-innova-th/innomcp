# Phase 8.8 Test Cases

## Logging Redaction Verification

1. **Case: Auth Header Redaction**
   - Trigger a request containing `Authorization: Bearer <token>`.
   - Verify the generated logs do not log the `Authorization` header.

2. **Case: URL Parameter Redaction (`ukey` / `uid`)**
   - Execute an HTTP request to an internal endpoint (e.g., TMD tools) including `?ukey=SECRET&uid=123`.
   - Verify the logging adapter intercepts and masks the token before writing the URL to standard out.

3. **Case: requestInfo.headers Elimination**
   - Send a rich request context.
   - Inspect the pipeline budget logs and general MCP logs to ensure `requestInfo.headers` is strictly stripped or sanitized.

4. **Case: Production Mode Silence**
   - Ensure the server operates correctly without printing test mode placeholders (`โหมดทดสอบ`, `เพื่อการทดสอบระบบ`).
