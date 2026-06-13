<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-018 role=trace model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1865,"completion_tokens":5000,"total_tokens":6865,"prompt_tokens_details":{"cached_tokens":56,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5004,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 48s
 generated: 2026-06-13T12:02:28.940Z -->
**Trace pass through `innomcp-node/src/services/providerFailover.ts`**  
*Ordered by typical lifecycle. All state is in-memory only; no DB, no filesystem, no event bus.*

---

### Step 1 – Module load / singleton instantiation
- **Enters:** Nothing (default arguments applied).
  - `primaryId` defaults to `'mdes-ollama'`
  - `backupIds` defaults to `['ollama-local', 'openai-compatible']`
  - `failThreshold` = `3`
  - `cooldownMs` = `60000`
- **Transform:** Constructor allocates `this.statuses = new Map<string, ProviderStatus>()` and inserts 3 objects:
  ```ts
  {
    id: <providerId>,
    healthy: true,
    latencyMs: 0,
    failCount: 0,
    lastCheck: Date
