<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-006 role=fuzz model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":2712,"completion_tokens":2306,"total_tokens":5018,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":808,"image_tokens":0},"cache_creation_input_tokens":0} | 23s
 generated: 2026-06-13T11:59:29.876Z -->
```markdown
- **Property:** `agentPlan` always returns at least 2 agents for any known intent.
  - **Fuzz input:** `agentPlan({ intent: "weather", query: "" })` (0 tokens)
  - **Expected invariant:** `returnedArray.length >= 2`

- **Property:** For greeting/datetime/weather/general/knowledge/geo/calc with query ≤ 25 tokens, exactly 2 agents are returned.
  - **Fuzz input:** `agentPlan({ intent: "greeting", query: "Hi" })` (1 token)
  - **Expected invariant:** `returnedArray.length === 2`

- **Property:** For greeting/datetime/weather/general/knowledge/geo/calc with query between 26 and 50 tokens, exactly 3 agents are returned.
  - **Fuzz input:** `agentPlan({ intent: "knowledge", query: "Explain the difference between quantum mechanics and classical physics in three paragraphs." })` (estimated 45 tokens)
  - **Expected invariant:** `returnedArray.length === 3`

- **Property:** For general/knowledge with query > 50 tokens, exactly 4 agents are returned.
  - **Fuzz input:** `agentPlan({ intent: "general", query: "A ".repeat(100) })` (200 tokens)
  - **Expected invariant:** `returnedArray.length === 4`

- **Property:** For `planning-broad` intent, exactly 6 agents are always returned regardless of query length.
  - **Fuzz input:** `agentPlan({ intent: "planning-broad", query: "Short" })`
  - **Expected invariant:** `returnedArray.length === 6`

- **Property:** For `code` intent, exactly 8 agents are always returned.
  - **Fuzz input:** `agentPlan({ intent: "code", query: "Write a sorting function in Rust" })`
  - **Expected invariant:** `returnedArray.length === 8`

- **Property:** For unknown intent string, `agentPlan` returns at least 2 agents (likely defaults to "general").
  - **Fuzz input:** `agentPlan({ intent: "nonexistent-intent-12345", query: "Hello" })`
  - **Expected invariant:** `returnedArray.length >= 2 && returnedArray.every(item => item.agentId !== "")`

- **Property:** All returned agents have distinct `agentId`s.
  - **Fuzz input:** `agentPlan({ intent: "evidence", query: "Check this claim." })`
  - **Expected invariant:** `new Set(returnedArray.map(a => a.agentId)).size === returnedArray.length`

- **Property:** Every `AgentPlanItem` has positive `timeoutMs` and non-empty `url`, `key`, `model`.
  - **Fuzz input:** `agentPlan({ intent: "calc", query: "2+2"})`
  - **Expected invariant:** `returnedArray.every(item => item.timeoutMs > 0 && item.url !== "" && item.model !== "")`

- **Property:** When `runMode` is "thinking", timeouts are double the normal value for the model.
  - **Fuzz input:** `agentPlan({ intent: "geo", query: "Map of Bangkok", runMode: "thinking" })`
  - **Expected invariant:** `returnedArray.every(item => item.timeoutMs >= (MODEL_TIMEOUT_MS[item.model] || DEFAULT_TIMEOUT_MS) * 2)`

- **Property:** When `remoteAvailable` is false, all endpoints have kind `local`.
  - **Fuzz input:** `agentPlan({ intent: "knowledge", query: "What is AI?", remoteAvailable: false })`
  - **Expected invariant:** `returnedArray.every(item => item.kind === "local")`

- **Property:** Thai language query with `THAI_LLM_MODEL` set overrides model for `rag-agent` and `linguist`.
  - **Fuzz input:** `process.env.THAI_LLM_MODEL = "openthaigpt:7b"; agentPlan({ intent: "knowledge", query: "สวัสดีครับ" })`
  - **Expected invariant:** `returnedArray.find(a => a.agentId === "rag-agent")?.model === "openthaigpt:7b"`

- **Property:** When `PARALLEL_AGENTS` env is `"0"`, the dispatch returns empty array (skip mode).
  - **Fuzz input:** `process.env.PARALLEL_AGENTS = "0"; agentPlan({ intent: "weather", query: "Rain?" })`
  - **Expected invariant:** `returnedArray.length === 0`

- **Property:** `history` array with missing `text` field is handled gracefully (does not throw).
  - **Fuzz input:** `agentPlan({ intent: "general", query: "Hello", history: [{ sender: "user", text: undefined }] })`
  - **Expected invariant:** Does not throw TypeError; returns valid array.

- **Property:** `preferredMode` is non‑mandatory and any string value is accepted.
  - **Fuzz input:** `agentPlan({ intent: "code", query: "Hello", preferredMode: "invalid-mode-xyz" })`
  - **Expected invariant:** No crash; `returnedArray.every(item => item.model !== "")`

- **Property:** Null or undefined options fields are tolerated.
  - **Fuzz input:** `agentPlan({ intent: "datetime", query: "What time is it?", remoteAvailable: null })`
  - **Expected invariant:** Returns a plan with `kind` defaulting to local (since null is falsy).

- **Property:** Environment variables with empty strings do not break URL resolution.
  - **Fuzz input:** `process.env.OLLAMA_BASE_URL = ""; agentPlan({ intent: "calc", query: "1+1" })`
  - **Expected invariant:** `url` is the default `"http://localhost:11434"` (or `"https://ollama.mdes-innova.online"` for remote).

- **Property:** Token counts that are negative or NaN are clamped/ignored (no crash).
  - **Fuzz input:** `agentPlan({ intent: "general", query: "Test", tokens: -5 })` (if `tokens` parameter exists; else rely on internal tokenizer)
  - **Expected invariant:** The function does not throw; returns a plan with valid agent count.

- **Property:** Agents from both `INTENT_AGENTS` and `INTENT_AGENTS_POOL` are valid.
  - **Fuzz input:** `agentPlan({ intent: "evidence" })` (uses pool, not legacy)
  - **Expected invariant:** All `agentId` values are in the combined set of known agent IDs.
```
