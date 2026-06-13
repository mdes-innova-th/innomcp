<!-- cc-team deliverable
 group: G2 (perf division)
 member: PER-033 role=perf model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2761,"completion_tokens":2148,"total_tokens":4909,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1952,"image_tokens":0},"cache_creation_input_tokens":0} | 30s
 generated: 2026-06-13T12:05:36.876Z -->
| severity | location | issue | fix |
|----------|----------|-------|-----|
| low | `buildProbeTargets` (module scope) | No caching of the probe target array; every call re‑reads environment variables and rebuilds the full list of 20 targets, allocating temporary arrays (e.g. `OPENAI_FALLBACK_MODELS` split) and objects. | Store the result in a module‑level `const` (lazy initialisation with a null check) so it is computed once at first use. |
| low | `buildProbeTargets`, line containing `commandCodeUsesOpenAiProxyShape` | Regular expression literal `/(^https?:\/\/)?(127\.0\.0\.1|localhost|host\.docker\.internal):4322\b/` is compiled on every invocation. | Define the regex as a `const` at module scope to avoid repeated compilation overhead. |
