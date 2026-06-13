<!-- cc-team deliverable
 group: G1 (Security audit)
 member: SEC14 role=security model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2568,"completion_tokens":2884,"total_tokens":5452,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2665,"image_tokens":0},"cache_creation_input_tokens":0} | 38s
 generated: 2026-06-13T11:22:08.297Z -->
| severity | location | vulnerability | exploit scenario | fix |
|----------|----------|---------------|------------------|-----|
| HIGH | `addModel` (unvalidated `endpoint` stored) → health probe (`probeModel` uses it) | Server-Side Request Forgery (SSRF) via user-controlled model endpoint in health checks. | An attacker with access to `addModel` injects `http://169.254.169.254/latest/meta-data/` as `endpoint`. Periodic health probes make requests to the attacker-supplied URL, exfiltrating cloud metadata or hitting internal services. | Validate `endpoint` URL before storing: enforce HTTPS only, disallow loopback/private/link-local IPs, maintain an allowlist of permitted domains, or ensure `probeModel` uses a strict HTTP client with network restrictions. |

**Verdict:** Missing validation on the `endpoint` field allows SSRF if health probes are triggered; the hardcoded default is safe, but attacker-controlled additions are dangerous.
