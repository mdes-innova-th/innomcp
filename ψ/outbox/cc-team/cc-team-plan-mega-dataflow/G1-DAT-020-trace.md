<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-020 role=trace model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1988,"completion_tokens":2041,"total_tokens":4029,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 40s
 generated: 2026-06-13T12:02:57.271Z -->
# Trace: `providerManager.ts` Data Flow

## Module Inputs
- **Constructor entry:** `process.env.MDES_OLLAMA_URL` (string, env), `process.env.MDES_OLLAMA_MODEL` (string, env)
- **Public method inputs:** `ProviderConfig` (object), `id: string`, `capability?: string`, `task: 'thai'|'code'|'reasoning'|'fast'|'general'`
- **Network input:** HTTP GET response from `<baseUrl>/health` (network)

## Module Outputs
- `Promise<void>` (register/unregister)
- `Promise<ProviderConfig[]>` (getAll/checkAllHealth)
- `Promise<ProviderConfig | undefined>` (getBest)
- `Promise<{ healthy: boolean; latencyMs: number }>` (checkHealth)
- `ProviderConfig` (getMDESPrimary — sync)
- `Promise<ProviderConfig>` (selectForTask)
- **Exported singleton:** `providerManager` (instance)

## Side Effects
- **In-memory state:** `this.providers: Map<string, ProviderConfig>` (mutation throughout)
- **Network:** outbound HTTP GET requests (checkHealth, checkAllHealth)
- **Timers:** `setTimeout`/`clearTimeout` for 10s abort
- **No DB, no filesystem, no event emission, no logging**

---

## Step List

### Step 1 — Module Load
- **Enters:** ESM import side-effect
- **Transform:** None (type/interface declarations)
- **Exits:** Exports `ProviderConfig`, `ProviderManager`, `providerManager`
- **Side effects:** None

### Step 2 — Singleton Instantiation (`new ProviderManager()`)
- **Enters:** No runtime args
- **Transform:** `this.providers = new Map()` (empty)
- **Transform:** Calls `registerDefaultMDESPrimary()`
- **Exits:** Singleton `providerManager` ready
- **Side effects:** Heap-allocated singleton

### Step 3 — `registerDefaultMDESPrimary()` (private, called at Step 2)
- **Enters:** `process.env.MDES_OLLAMA_URL ?? 'http://localhost:11434'`, `process.env.MDES_OLLAMA_MODEL ?? 'mdes-llm-v1'`
- **Transform:** Builds `ProviderConfig` literal with fixed `id='mdes-primary-ollama'`, `priority=100`, `enabled=true`, `healthStatus='unknown'`, capabilities array of 5 strings
- **Exits:** Config object → `this.providers.set('mdes-primary-ollama', config)`
- **Side effects:** Map mutation (1 entry)
- **Destination:** `this.providers` map, key `mdes-primary-ollama`

### Step 4 — `register(config)` (caller-driven)
- **Enters:** `ProviderConfig` (caller-supplied)
- **Transform:** Validate `id`, `baseUrl`, `model` present → throw `Error` if not
- **Transform:** `this.providers.get(id)` → `existing` (or undefined)
- **Branch A (no existing):** Spread `config`, default `healthStatus='unknown'`, `capabilities=[]`, `enabled=true`, `priority=0` → set
- **Branch B (existing):** Merge `{...existing, ...config}`, preserve `healthStatus`/`latencyMs`/`lastChecked` from `existing` when new omits them → set
- **Exits:** `Promise<void>`
- **Side effects:** Map mutation
- **Throw destination:** Caller's rejected promise

### Step 5 — `unregister(id)`
- **Enters:** `id: string`
- **Transform:** `this.providers.delete(id)` (no-op if absent)
- **Exits:** `Promise<void>`
- **Side effects:** Map mutation (potential removal)

### Step 6 — `getAll()`
- **Enters:** Nothing
- **Transform:** `Array.from(this.providers.values())` → spread-copy each entry
- **Exits:** `Promise<ProviderConfig[]>` (shallow clones — note: nested arrays like `capabilities` are shared references)
- **Side effects:** None

### Step 7 — `getBest(capability?)`
- **Enters:** `capability?: string`
- **Transform 1:** Filter `p.enabled === true`
- **Transform 2 (optional):** Filter `p.capabilities.includes(capability)`; return `undefined` if empty
- **Transform 3:** Sort comparator — (a) `priority` desc, (b) `healthStatus` order `{healthy:0, degraded:1, unknown:2}` asc, (c) `latencyMs ?? Infinity` asc
- **Transform 4:** Spread-copy `candidates[0]`
- **Exits:** `Promise<ProviderConfig | undefined>`
- **Side effects:** None

### Step 8 — `checkHealth(id)`
- **Enters:** `id: string`
- **Transform 1:** `this.providers.get(id)`; throw if absent
- **Transform 2:** Construct `AbortController` + `setTimeout(abort, 10_000)`; record `start = Date.now()`
- **Transform 3:** `new URL('/health', provider.baseUrl).toString()` → URL string
- **Transform 4 (network):** `fetch(url, { method:'GET', signal, headers?: {Authorization: 'Bearer <apiKey>'} })`
  - Headers omitted if `apiKey` is undefined
- **Transform 5 (success path, `response.ok`):** `clearTimeout`; mutate `provider.healthStatus='healthy'`, `provider.latencyMs=latency`, `provider.lastChecked=Date.now()`
- **Transform 6 (failure path — non-2xx or thrown):** `clearTimeout`; mutate `provider.healthStatus='degraded'`, `provider.latencyMs=latency`, `provider.lastChecked=Date.now()`; swallow error
- **Exits:** `Promise<{ healthy: boolean; latencyMs: number }>`
- **Side effects:** Map mutation (3 fields on matched provider); 1 HTTP request; 1 timer (always cleared)
- **Throw destination:** Caller's rejected promise only if `id` unknown

### Step 9 — `checkAllHealth()`
- **Enters:** Nothing
- **Transform:** `Promise.allSettled(ids.map(id => this.checkHealth(id)))` — fires N concurrent fetches, isolates rejections
- **Transform:** `await this.getAll()` (post-mutation snapshot)
- **Exits:** `Promise<ProviderConfig[]>` — returns configs reflecting health updates from Step 8
- **Side effects:** N HTTP requests (concurrent); map mutations via Step 8

### Step 10 — `getMDESPrimary()`
- **Enters:** Nothing
- **Transform:** `this.providers.get('mdes-primary-ollama')`; throw if absent (e.g., someone called `unregister` on it)
- **Transform:** Spread-copy
- **Exits:** `ProviderConfig` (synchronous)
- **Side effects:** None

### Step 11 — `selectForTask(task)`
- **Enters:** `task: 'thai'|'code'|'reasoning'|'fast'|'general'`
- **Transform 1:** Lookup `capabilityMap[task]` → string capability
- **Transform 2:** `await this.getBest(capability)`
- **Branch A (found):** Return that provider
- **Branch B (not found):** `await this.getBest()` (no filter); throw if still empty
- **Exits:** `Promise<ProviderConfig>` (always, unless no providers at all)
- **Side effects:** None (read-only)

---

## Summary Table

| Step | Method | Input Shape | Output Shape | Network | State Mutated |
|------|--------|-------------|--------------|---------|---------------|
| 1 | module load | — | exports | no | no |
| 2 | constructor | — | instance | no | map init |
| 3 | registerDefaultMDESPrimary | env vars | ProviderConfig | no | map +1 |
| 4 | register | ProviderConfig | void | no | map upsert |
| 5 | unregister | id: string | void | no | map −1 |
| 6 | getAll | — | ProviderConfig[] | no | no |
| 7 | getBest | capability?: string | ProviderConfig? | no | no |
| 8 | checkHealth | id: string | {healthy,latencyMs} | yes (1×) | provider 3 fields |
| 9 | checkAllHealth | — | ProviderConfig[] | yes (N×) | provider × N |
| 10 | getMDESPrimary | — | ProviderConfig | no | no |
| 11 | selectForTask | task enum | ProviderConfig | no | no |

## Cross-cutting Notes
- **Concurrency:** `checkAllHealth` fans out unbounded — no rate limiting, no semaphore. A 100-provider registry = 100 parallel 10s-capable fetches.
- **Leak risk:** `setTimeout` is cleared in both try and catch; no leak path observed.
- **Aliasing:** `getAll`/`getBest`/`getMDESPrimary` return spread copies of top-level fields, but `capabilities` array references are shared — caller mutation leaks into the Map.
- **No persistence:** All state is process-local; restart loses registrations except the auto-registered MDES default.
