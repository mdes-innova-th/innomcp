<!-- cc-team deliverable
 group: G1 (Security audit)
 member: SEC17 role=security model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2527,"completion_tokens":2093,"total_tokens":4620,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1648,"image_tokens":0},"cache_creation_input_tokens":0} | 31s
 generated: 2026-06-13T11:22:38.819Z -->
| Severity | Location | Vulnerability | Exploit Scenario | Fix |
|----------|----------|---------------|------------------|-----|
| HIGH | `callOpenAI`, `streamOpenAI`, `callAnthropic`, `streamAnthropic` – `fetch()` base URL concatenation | Server‑Side Request Forgery (SSRF) via unvalidated `provider.baseUrl` | Attacker registers a provider with `baseUrl = "http://169.254.169.254"`; adapter makes request to cloud metadata endpoint, leaking service‑account tokens / internal secrets. | Validate `provider.baseUrl` against a whitelist (e.g., only `api.openai.com`, `api.anthropic.com`, and exactly registered Ollama hosts); reject arbitrary URLs and non‑HTTPS schemes. |
| MEDIUM | `callOpenAI`, `streamOpenAI`, `callAnthropic`, `streamAnthropic` – error handling that includes raw API error body (`errorText`) | Secret leakage in error messages / logs | Provider returns 4xx with body `{"error": "Invalid API key: sk-abc123"}`; exception message or SSE error chunk reveals the key, which gets logged or returned to UI. | Sanitise `errorText` before inclusion: redact patterns matching known key formats (`sk-…`, `claude-…`) and avoid exposing raw upstream error bodies to callers. |
| HIGH | `requireApiKey` + subsequent `callOpenAI` / `callAnthropic` / stream variants | Missing authorization checks (caller not verified) | Any internal module that can import `callOpenAI` / `callAnthropic` can invoke them with any `ProviderRecord`, consuming paid API credits or accessing restricted models without user‑level permission checks. | Enforce caller identity / permissions before executing provider calls; e.g., require a valid user session token and verify that the user is allowed to use the specific provider/model. |

**Verdict:** SSRF via unvalidated base URL and missing caller authorization allow unauthorised internal API access; error responses may leak API keys.
