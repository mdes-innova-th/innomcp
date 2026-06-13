<!-- cc-team deliverable
 group: G1 (Security audit)
 member: SEC19 role=security model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2812,"completion_tokens":2218,"total_tokens":5030,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1966,"image_tokens":0},"cache_creation_input_tokens":0} | 30s
 generated: 2026-06-13T11:22:49.195Z -->
| severity | location | vulnerability | exploit scenario | fix |
|----------|----------|---------------|------------------|-----|
| CRITICAL | `providerHealthProbe.ts` – `buildProbeTargets()` (baseUrl from env vars) and probe execution for openai/anthropic/ollama | SSRF + API key exfiltration due to unvalidated `baseUrl` from environment variables used directly in outgoing requests | Attacker sets `OPENAI_BASE_URL` (or any other provider’s env var) to a malicious server; health probe on startup sends `Authorization: Bearer <API_KEY>` to attacker’s server, leaking the secret | Validate every `baseUrl` against an allowed list of provider domains; block internal IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, metadata endpoints); enforce HTTPS except for explicit localhost dev overrides; use a URL parser and compare hostname strictly |

**Verdict:** Unvalidated provider base URLs allow full SSRF and silent exfiltration of all configured API keys.
