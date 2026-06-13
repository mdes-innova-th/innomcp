<!-- cc-team deliverable
 group: G2 (Security audit)
 member: SEC29 role=security model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2269,"completion_tokens":3274,"total_tokens":5543,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2782,"image_tokens":0},"cache_creation_input_tokens":0} | 53s
 generated: 2026-06-13T11:25:50.961Z -->
| severity | location | vulnerability | exploit scenario | fix |
|----------|----------|---------------|------------------|-----|
| CRITICAL | `fireWebhook()` and `fireWebhookById()` – `fetch(wh.url)` | **SSRF via unvalidated webhook URL** | Attacker creates a webhook with `url` = `http://169.254.169.254/latest/meta-data/` and triggers it; `fetch` follows redirects and returns AWS credentials/exposes internal services. | Validate that `url` uses only `https:`, block private/reserved IPs (e.g., `10.0.0.0/8`, `169.254.169.254`), or enforce a domain allowlist. |
| CRITICAL | `listWebhooks()` and `getWebhook()` return `Webhook` with `secret` field | **Unprotected exposure of webhook secrets** | An unauthenticated caller calls `listWebhooks()` and receives all webhook objects including signing secrets, enabling signature forgery and impersonation of legitimate webhooks. | Strip `secret` from API responses; never return secrets to callers. Enforce authentication before returning any webhook data. |
| HIGH | `deleteWebhook(id)`, `toggleWebhook(id, enabled)`, `fireWebhookById(id, ...)` | **Missing authorization (IDOR / ownership check)** | Any caller knowing a webhook `id` can delete, disable, or forcibly fire another user’s webhook without any ownership verification. | Require an authenticated user context and verify that `webhook.userId` matches the caller’s identity before performing mutating operations. |
| MEDIUM | `fireWebhook()` error/fallback logging – `console.warn(… wh.url …)` | **Secret leakage in logs (URL may contain tokens)** | Slack webhook URLs embed secrets in the path (e.g., `/services/.../token`); logging the full URL on delivery failure writes these tokens into logs, allowing anyone with log access to hijack the webhook. | Sanitize logged URLs (e.g., log only the origin or mask the path/query) before writing to logs. |

**Verdict:** Unsafe – unauthenticated SSRF, exposed webhook secrets, and missing ownership checks enable full compromise.
