<!-- cc-team deliverable
 group: G1 (apicontract division)
 member: APIC-018 role=contract model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":2016,"completion_tokens":5000,"total_tokens":7016,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5197,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 55s
 generated: 2026-06-13T12:11:58.952Z -->
| severity | endpoint | issue | fix |
|---|---|---|---|
| **High** | `GET /api/health` | **Polymorphic response contract without versioning.** The legacy branch returns a flat enriched object (`mode`, `redis_*`, `providers`, etc.). The `?detailed=true` branch returns a nested `liveness/readiness` bundle. Error branches return ad-hoc shapes (`message` vs
