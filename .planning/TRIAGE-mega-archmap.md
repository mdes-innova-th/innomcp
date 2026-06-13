_30 findings consolidated, 0 missing._

# TRIAGE — mega-archmap

> archmap lens (provider=0): EXPLAIN this module for an architecture map (a /learn pass): its single responsi

> Generated for mother-Sonnet review. provider=0 deliverables.


---

## ARC-001 — learn — `innomcp-node/src/agents/conductor.ts` [deepseek/deepseek-v4-pro]
**Single responsibility:** Orchestrates a deterministic, LLM‑free agent run (Phase C) – classifies intent, dispatches sub‑agents, gathers facts, composes a safe, Thai‑templated answer, and emits every event through a public‑safety gate.

**Exported API:**  
`run(options: ConductorOptions, emit: EmitFn): Promise<RunResult>` – the main entrypoint that produces agent events and the final text.

**Upstream callers:** The chat API route (e.g., `routes/api/chat`).

**Downstream deps:** Intent classifier, parallel/tool/mother dispatchers, provider adapter, session memory, system inventory, event guard, and naturalness guard.

**Role in chat/agent pipeline:** The central conductor; it turns a user message into an event‑gated plan, runs parallel agent steps, and returns a templated final answer without calling an LLM (placeholder for future Ollama streaming).

**Surprising coupling:** A direct `require("../routes/api/chat")` to grab a runtime `mcpClient` from the Express route, tightly binding the orchestrator to server‑side state and the HTTP layer.

---

## ARC-002 — learn — `innomcp-node/src/agents/eventGuard.ts` [Qwen/Qwen3.7-Max]
**Single Responsibility:** Outbound sanitization gate blocking `AgentEvent`s containing internal reasoning, secrets, or debug placeholders from the public SSE stream.

**Key API:** `checkAgentEventSafe(event, opts)` and `checkVisibleTextSafe(text, opts)` returning a `GuardResult`.

**Upstream/Downstream:** Called by the SSE orchestrator and naturalness guard. Depends on `./events` for `AgentEvent` shape validation.

**Pipeline Role:** Final pre-write filter in the agent pipeline, preventing prompt-leakage and UI noise before network emission.

**Surprising Coupling:** Despite acting as a generic security boundary, it hardcodes domain-specific map literals (e.g., Thai map errors, "Weather Map Placeholder") and map-specific flags (`allowMapTerms`). Furthermore, it deliberately bypasses TypeScript type-safety, relying on naive `JSON.stringify` substring scanning to catch untyped runtime object merges.

---

## ARC-003 — learn — `innomcp-node/src/agents/events.ts` [moonshotai/Kimi-K2.6]
- **Responsibility:** Canonical SSE event contract for the agent-to-frontend stream; defines the public-safe schema, runtime shape validator, and envelope factory.
- **Key API:** `AgentEvent` interface, `AgentEventType`/`AgentId` unions, `validateAgentEvent()` checker, `newEnvelope()` factory.
- **Callers & Deps:** Orchestrator/agents use these types to build `/api/chat/stream` payloads; frontend `ThinkingPanel` consumes them. No internal runtime deps (schema-only), though `eventGuard.ts` is the complementary safety gate.
- **Pipeline role:** Boundary contract layer that translates raw internal agent activity into a strictly user-safe, serializable stream shape before UI consumption.
- **Surprising coupling:** Hardcoded Thai role labels (`AGENT_ROLE_LABEL_TH`) in the backend schema module, tightly coupling event definitions to frontend UI localization.

---

## ARC-004 — learn — `innomcp-node/src/agents/motherDispatch.ts` [zai-org/GLM-5.1]
**Single Responsibility**: Orchestrates concurrent fan-out to multiple AI providers, tracking latency/cost, and returning the best synthesis.

**Key Exported API**: `MotherDispatchResult`, `INTENT_KEYWORDS`, `AI_ISMS`, `dispatchMother`.

**Upstream Callers**: Conductor (specifically in "thinking mode").

**Downstream Deps**: `providers/registry`, `providers/router`, `leaderboardMetrics`, `motherHistory`, `errorRecovery`, `motherProviderToggle`, and external AI APIs (OpenAI, Anthropic, Ollama, Innova Oracle).

**Role in Pipeline**: Acts as the "Mother" aggregator during deep thinking; queries diverse models simultaneously to select the highest-quality synthesis.

**Surprising Coupling**: Caches Innova Oracle auth tokens in module-level state (`_oracleToken`), and directly reads the `MDES_ONLY` env var to restrict routing, tightly coupling infrastructure policy to dispatch logic.

---

## ARC-005 — learn — `innomcp-node/src/agents/orchestrator.ts` [deepseek/deepseek-v4-pro]
**Single responsibility:** Orchestrates a 3-brain agent pipeline (Brain‑1 deep analysis → Brain‑2 fast summary → Coordinator action/memory) for a given task.  
**Key API:** `MultiAgentOrchestrator` class – `createTask()` and `executeCycle()`; types such as `OrchestratorConfig`, `AgentTask`, `TaskCycle`.  
**Upstream callers:** TUI or chat controller issuing multi‑agent reasoning tasks (likely a “learn” pass).  
**Downstream deps:** `../providers/router` (provider selection), `fetch` to local Ollama endpoints; memory persistence writes to the shared `sharedMemoryPath`.  
**Role in pipeline:** Phase C neural coordinator – takes a task, runs the full analysis→summary→commit/review cycle, and records the decision cycle to disk.  
**Surprising coupling:** Hard‑codes default models (Minimax, Gemma variants) and directly calls Ollama `api/generate` with raw `fetch`; coordinator parses a single‑word action from LLM output (COMMIT/REVIEW/PUSH/SKIP), which is brittle and tightly couples to text generation shape.

---

## ARC-006 — learn — `innomcp-node/src/agents/parallelDispatch.ts` [deepseek/deepseek-v4-flash]
**Single Responsibility:** Orchestrates MDES multi-agent dispatch based on intent and query complexity; uses ≥2 child agents (thinker + responder) per query, escalating to GPT only after two MDES failures.

**Key Exported API:** `AgentPlanItem`, `AgentDispatchOptions`, `AgentPlanOptions`, `INTENT_AGENTS` (legacy), `INTENT_AGENTS_POOL`, and likely a dispatch function (not fully shown).

**Upstream Callers:** Mother/conductor module. **Downstream Dependencies:** `./events` (AgentId, envelope), `./eventGuard`, `./conductor` (EmitFn), `../providers/router` (ChatMode), plus numerous environment variables for Ollama endpoints.

**Role in Pipeline:** Phase 10.16 – mother-orchestrated MDES dispatch; selects agents per intent (e.g., `"knowledge": [thinker, rag-agent, …]`) and scales count by query token length.

**Surprising Coupling:** Hardcoded intent→agent pools and role→model mappings (e.g., `critic: gemma4:e4b`). Coexistence of legacy `INTENT_AGENTS` and new `INTENT_AGENTS_POOL` for backward compatibility.

---

## ARC-007 — learn — `innomcp-node/src/agents/toolDispatch.ts` [Qwen/Qwen3.7-Max]
**Single Responsibility:** Translates classified chat intents and raw queries into structured MCP tool execution plans and dispatches them.

**Key API:** `ToolPlan` (interface), `planToolCall(intent, query)` (maps intent to tool/args).

**Upstream/Downstream:** Upstream: `conductor` (SSE orchestrator), `intentClassifier`. Downstream: External MCP JSON-RPC server, `guestLimiter`.

**Pipeline Role:** Bridges intent classification and tool execution. Emits `tool_call_*` SSE events for the `MultiAgentPanel` UI, then returns results to MDES agents for synthesis.

**Surprising Coupling:** Embeds heavy, hardcoded regex heuristics for entity extraction (Thai/English math, weather, ISP, evidence signals) directly in the dispatcher rather than using an LLM or dedicated NER service. Also tightly couples to `guestLimiter` middleware for access checks inside the dispatch flow.

---

## ARC-008 — learn — `innomcp-node/src/providers/registry.ts` [moonshotai/Kimi-K2.6]
**Single responsibility:** Boot-time, in-memory catalog of LLM provider metadata (`ProviderRecord`), seeded conditionally from `process.env`.

**Key exported API:** CRUD surface over a private `Map`—`upsert`, `get`, `list`, `remove`—consuming `ProviderUpsertInput` validated by `./types`.

**Upstream callers:** Admin configuration routes and the chat/agent router that queries capability/priority to select a provider before dispatching a request.

**Downstream deps:** `./types` (domain types, `validateUpsertInput`), `node:crypto`, and host environment variables.

**Role in pipeline:** Configuration plane; separates provider metadata from client instantiation, enabling capability-based routing.

**Surprising coupling:** Seed construction eagerly reads numerous `process.env` variables at module-import time, binding registry state to global env vars before any function invocation and making the module hard to test without pre-import env setup.

---

## ARC-009 — learn — `innomcp-node/src/providers/router.ts` [deepseek/deepseek-v4-pro]
**Single responsibility:** Provider broker – selects the “best” LLM provider from the registry based on request mode, required capabilities, privacy, and health; it does not invoke the model.

**Key exported API:**  
- `selectProvider(opts)` → `SelectionResult` (chosen provider, fallback alternates, Thai reason).  
- `getAvailableProviders()` → `string[]` of env‑gated IDs.  
- `resolveProviderEndpoint(id)` → `{url, key, model}`.  
- `previewSelection(opts)` → UI‑friendly selection preview.

**Upstream callers:** Chat/agent dispatch layer that needs to route a prompt to a concrete provider. Typically invoked before building the LLM client.

**Downstream deps:** `./registry` (listProviders, getProvider, resolveApiKey) and environment variables (process.env). Types from `./types`.

**Role in chat/agent pipeline:** Acts as a decision point that maps a high‑level request specification (mode “local/remote/hybrid”, capability list, privacy) into a concrete provider record, enabling fallback chains and manual overrides.

**Surprising coupling:** `getAvailableProviders` reads `process.env` directly, bypassing the registry abstraction and coupling routing logic to environment variable names. This makes testing harder and ties provider discovery to the Node runtime.

---

## ARC-010 — learn — `innomcp-node/src/providers/types.ts` [MiniMaxAI/MiniMax-M3]
**Module: `providers/types.ts`**

**Single responsibility:** Define the canonical schema for the AI provider registry — internal `ProviderRecord` (server-side, holds secret refs), public `ProviderPublicView` (wire-safe), and `ProviderUpsertInput` (write API), plus enums (`ProviderType`, `Capability`, `PrivacyLevel`, `HealthStatus`).

**Key exported API:** Types + `toPublicView()` projection + `validateUpsertInput()` (first-error string or `null`). Hard rule: secrets (env-var name or encrypted blob) never reach the wire — collapsed to `hasApiKey: boolean`.

**Upstream callers:** `providers/registry.ts` (CRUD endpoints, GET `/api/ai/providers`), admin UI forms, capability-router that selects providers by tag (e.g. `thai-naturalness`, `hard-reasoning`).

**Downstream deps:** None — pure type/utility module, but consumed transitively by chat/agent pipeline when picking a model and by health-check workers.

**Pipeline role:** Schema contract between registry persistence and the request layer; `toPublicView` is the leak barrier for secrets in list responses.

**Surprising coupling:** `Capability` taxonomy is a closed string union — adding a new agent skill (e.g. `audio`, `web-search`) requires editing this file, breaking every consumer until types propagate. `validateUpsertInput` only checks shape, not capability values, leaving that gap to the route handler.

---

## ARC-011 — learn — `innomcp-node/src/services/agentLoop.ts` [deepseek/deepseek-v4-flash]
**Single responsibility:** Implements a plan‑act‑observe agent loop that drives an LLM to autonomously complete a task using tools.

**Key exported API:**  
- `runAgentLoop(...)` – an async generator yielding `AgentEvent` (plan, tool_call, tool_result, message, artifact, done, error).  
- `AgentEvent` type – consumed by UI or downstream processors.

**Upstream callers:** Workspace UI, agent runner, or any orchestrator that wants real‑time progress of an autonomous agent.

**Downstream deps:**  
- `ToolRegistry` (provides `getToolSpecs()` and `execute()`).  
- `llm` function (takes messages + tool specs, returns content or tool calls).  
- Optional `AbortSignal`.

**Role in pipeline:** Central orchestration: yields events for each step, manages conversation history, enforces max steps, handles aborts, and sanitizes errors.

**Surprising coupling:** None; it’s cleanly decoupled via dependency injection. The only implicit coupling is the expectation that `ToolRegistry` and `llm` follow the exact interfaces defined in the signature.

---

## ARC-012 — learn — `innomcp-node/src/services/analyticsService.ts` [Qwen/Qwen3.7-Max]
**Single Responsibility:** In-memory telemetry aggregation for LLM messages, tool executions, errors, and session lifecycles.

**Key Exported API:** Singleton `analyticsService` exposing `track()`, `getStats()`, session management, and JSON `save/loadSnapshot()`.

**Upstream Callers & Downstream Deps:** 
*Upstream:* Chat orchestrators, LLM clients, and tool runners. 
*Downstream:* Node `fs` and `path`.

**Role in Chat/Agent Pipeline:** Cross-cutting observability. It passively records execution metadata (latency, tokens, success rates) parallel to the main agent loop without blocking inference.

**Surprising Coupling:**
1. *Direct File I/O:* Embedding `fs` read/write logic for snapshots inside a core domain service violates separation of concerns; persistence should delegate to a dedicated repository or external telemetry sink.
2. *Global Singleton:* Exporting a pre-instantiated singleton (`export const analyticsService`) hardwires consumers to this specific instance, bypassing dependency injection and complicating unit test isolation.

---

## ARC-013 — learn — `innomcp-node/src/services/answerContract.ts` [deepseek/deepseek-v4-pro]
**Single Responsibility:** Defines the canonical structure (`AnswerContract`) and builder for structured metadata attached to every grounded answer—aggregating route, sources, freshness, memory, retrieval mode, confidence, degraded state, and timing.

**Key Exported API:**  
- Types: `AnswerContract`, `AnswerMode`, `RetrievalMode`, `RetrievalSource`.  
- Function: `buildAnswerContract(params)` – constructs a contract from routing results, computes aggregate freshness, separates hot/cold sources, and normalizes confidence.

**Upstream Callers:** Answer orchestration/pipeline stages that produce a final answer (router, LLM handler, fallback) and need to stamp it with provenance and quality metadata before returning to the client or logging.

**Downstream Dependencies:** Pure TypeScript; depends only on standard `Date` and array methods. No service imports.

**Pipeline Role:** Post‑processing metadata envelope. It standardizes observability data—capturing which tools/memory were used, source freshness, and degradation—enabling downstream audit, debugging, and analytics without scattering logic across the pipeline.

**Surprising Coupling:** The hard‑coded hot/cold classification (`type === "tool"|"api"|"database"` → hot, `"document"` → cold) ties the builder to specific source type strings. Adding a new source type (e.g., `"vector-index"`) silently classifies it as cold or omitted from hot/cold arrays, which may cause subtle mismatches in freshness/reporting. Deterministic answers are unconditionally marked `"live"` even with zero sources.

---

## ARC-014 — learn — `innomcp-node/src/services/artifactService.ts` [zai-org/GLM-5.1]
**Responsibility:** Adapts raw artifact data from the utility layer into the specific DTO (`buffer`, `mimeType`, `name`) required by the HTTP router.

**Exported API:** `listArtifacts(taskId)`, `getArtifact(taskId, name)`

**Upstream Callers:** HTTP router/controllers requesting task outputs.

**Downstream Deps:** `../utils/artifacts` (storage/data-access layer).

**Pipeline Role:** Final retrieval step; fetches generated agent outputs (files, logs, data) for client delivery post-task execution.

**Surprising Coupling:** The hardcoded `Buffer.from(artifact.content, 'utf-8')` tightly couples the service to text-based artifact storage. This implies binary artifacts (images, PDFs) will corrupt unless pre-encoded as UTF-8 strings in the utility layer, leaking storage implementation details into the transport/DTO formatting layer.

---

## ARC-015 — learn — `innomcp-node/src/services/auditLogger.ts` [MiniMaxAI/MiniMax-M3]
**Responsibility:** Append-only JSONL audit trail of security-relevant events (login, message_sent, file_access, data_export, etc.) with daily file rotation under `./logs/`.

**Exported API:** `auditLogger` singleton with `log(entry)`, `getEntries(filter)`, `exportCSV()`, `exportJSON()`, `clear(beforeTimestamp?)`, and `setAuthorizer(fn)`. Types: `AuditAction`, `AuditEntry`, `AuditFilter`.

**Pipeline role:** Cross-cutting observability — called from auth flows, message dispatch, provider switches, admin/export handlers. Sits *beside* the chat/agent core, not inside it.

**Dependencies:** `fs`, `path`, `crypto.randomUUID`; writes to filesystem under `process.cwd()`. No DB, no network, no other module imports.

**Surprising coupling:**
- **Global state via `process.cwd()`** — rotation breaks if cwd changes between calls.
- **In-memory `lastDate` cache** — race-prone; concurrent writers could clobber/rename each other's active file.
- **`setAuthorizer` is defined but never invoked** in this file — the authorization gate is dead code, suggesting an unwired RBAC hook.
- **Synchronous I/O** on the request path (`appendFileSync`) — couples audit cost directly to caller latency.
- **Read-modify-write in `clear()`** — not concurrency-safe, and silently discards `removedCount` per-file semantics.

---

## ARC-016 — learn — `innomcp-node/src/services/backpressureHandler.ts` [deepseek/deepseek-v4-flash]
**Single responsibility:** Concurrency throttling & priority queueing for async tasks, capping parallel execution and queue depth to prevent resource exhaustion.

**Key exported API:** Singleton `backpressureHandler` exposing `enqueue(task)`, `getStats()`, `drain()`, `clear()`, `setMaxConcurrent(n)`. `enqueue` returns a promise resolved when the task runs and completes.

**Upstream callers:** Any module performing LLM calls, tool executions, or agent steps that need backpressure (e.g., `TaskRunner`, `Orchestrator`).

**Downstream deps:** None—it wraps arbitrary `() => Promise<unknown>` functions; only depends on native `Promise`.

**Role in chat/agent pipeline:** Acts as a throttle in the execution layer, managing concurrency for expensive operations (e.g., model inference, external APIs). It prioritises tasks by priority, ensuring critical agent steps aren’t starved.

**Surprising coupling:** The singleton design means all callers share the same queue and limits, coupling unrelated flows. Priority sorting via binary search may be over-engineering for typical sub‑100 item queues.

---

## ARC-017 — learn — `innomcp-node/src/services/cacheManager.ts` [deepseek/deepseek-v4-pro]
**Single responsibility:** In-memory TTL‑evicting LRU cache with size cap and stats.  
**Key API:** Singleton `CacheManager.getInstance()` exposes `get<T>(key)`, `set(key, value, ttl?)`, `delete`, `has`, `clear`, `size()`, `stats(): CacheStats`, `configure(maxSize)`.  
**Upstream callers:** Any agent pipeline stage that benefits from memoizing expensive results – tool executors, embedding fetchers, MCP resource resolvers, context summarizers.  
**Downstream deps:** None; pure data‑structure using `Map` and a doubly linked list.  
**Role in chat/agent pipeline:** Sits as a cross‑cutting utility to avoid redundant LLM or API calls for identical inputs within a conversation turn or across similar tasks.  
**Surprising coupling:** The `CacheManager` is a hard global singleton, making parallel test suites and state isolation awkward; the background `setInterval` cleanup timer (unref’d) ties cache lifetime to the process rather than to an agent session, risking stale entries interleaving between unrelated runs.

---

## ARC-018 — learn — `innomcp-node/src/services/coldRetriever.ts` [moonshotai/Kimi-K2.6]
**Single responsibility:** Static, local document retrieval over a curated markdown/text corpus using TF-IDF + keyword matching; zero external vector DB dependency.

**Key exported API:** `ColdRetriever` class with `loadCorpus(dir)` (index), `search(query, options?)` (rank chunks), `getRegistry()` (list docs); types `ColdDocument`, `ColdChunk`, `ColdRetrievalResult`.

**Upstream/downstream:** Upstream: orchestrator or hybrid retriever merging "cold" static with "hot" live sources. Downstream: Node `fs`/`path` and `./answerContract` (`RetrievalSource`).

**Pipeline role:** Pre-generation RAG step that injects grounded, source-traceable document chunks into the LLM prompt context.

**Surprising coupling:** Domain taxonomy (weather, law, geo, etc.) hardcoded via Thai/English regexes against file paths, tightly coupling folder naming to business logic. Synchronous `fs` calls inside async `loadCorpus`. Confidence scoring (`score * 2`) arbitrarily scaled internally rather than normalized upstream.

---

## ARC-019 — learn — `innomcp-node/src/services/contextManager.ts` [zai-org/GLM-5.1]
**Single Responsibility:** Manages and trims conversation history per session to fit LLM token limits.

**Key Exported API:** Singleton `contextManager` exposing `addMessage()`, `getContext()`, `trim()`, `summarize()`, `clear()`, and `stats()`.

**Upstream/Downstream:** Called by chat/agent controllers upstream. Zero downstream dependencies (pure in-memory logic).

**Pipeline Role:** Pre-processing step before LLM API calls. It accumulates conversational turns and prunes older messages (always preserving the initial system prompt) to prevent context window overflow.

**Surprising Coupling:** 
1. `summarize()` is a dead method—it exists but isn't invoked by `trim()`, which simply drops old messages instead of summarizing them. 
2. The in-memory `Map` implicitly couples this service to a single-process lifecycle; it won't persist or scale across instances. 
3. Token counting uses a naive `length/4` heuristic rather than an actual tokenizer, risking inaccurate context truncation.

---

## ARC-020 — learn — `innomcp-node/src/services/dataAnalysisTool.ts` [MiniMaxAI/MiniMax-M3]
**dataAnalysisTool** — single-purpose CSV introspection.

**Responsibility:** Parse CSV (string or workspace file), compute per-column stats, optionally render a bar-chart SVG and persist it.

**Exported API:** `analyzeData(input, opts)` → `Promise<AnalysisResult>`; types `ColumnStats`, `AnalysisResult`.

**Pipeline role:** Downstream of the agent's tool dispatcher. The LLM emits a tool call (file path or inline CSV) → MCP tool wrapper invokes `analyzeData` → `summary`/`chartSvg`/`artifactPath` flow back into the chat as a tool result for the model to narrate.

**Upstream callers:** MCP tool server / agent executor registering it as a tool (likely peers with `sqlTool`, `chartTool`).

**Downstream deps:** `node:fs/promises`, `node:path` only — no DB, no charting lib.

**Surprising coupling:**
- Dual input mode couples the *pure parser* to filesystem I/O.
- Side effect: auto-writes `artifacts/charts/chart-<ts>.svg` whenever a chart is produced — the "analysis" module silently mutates the workspace.
- Naive CSV parser (no RFC 4180 escaped-quote handling, no `Date` type branch despite the union declaring it).
- Heuristic numeric detection (>70% parseable) silently misclassifies ID columns.

---

## ARC-021 — learn — `innomcp-node/src/services/eventBus.ts` [deepseek/deepseek-v4-pro]
Single responsibility: Typed pub/sub bus for decoupled, event-driven communication across the system.  
Key export: Singleton `eventBus` with `on`, `emit`, `off`, `once`, `removeAll`.  
Upstream emitters: Agent orchestrator (`agent:started`, `agent:done`), message handler (`message:sent`), tool executors (`tool:called`), health monitor (`mdes:healthy`, `mdes:down`), error reporters.  
Downstream subscribers: Loggers, telemetry, UI state, monitoring dashboards.  
Role in chat/agent pipeline: Orchestration backbone – signals message arrival, agent lifecycle, tool invocations, and errors, allowing tracing and reactive flows without direct coupling.  
Surprising coupling: Global singleton forcing all consumers to share the same bus; runtime error handlers are caught and logged to console, silently discarding failures; generic `Set<Function>` storage sacrifices type safety at runtime despite compile-time typed API.

---

## ARC-022 — learn — `innomcp-node/src/services/fastPathHandler.ts` [Qwen/Qwen3.7-Max]
**Single Responsibility:** Intercepts trivial inputs (greetings, pings, basic math) to return sub-1s responses, bypassing the heavy LLM pipeline.

**Key API:** `handleFastPathMessage` (main interceptor), plus `trigToDeg` and `cleanFloat` math-formatting helpers.

**Upstream/Downstream:** Invoked by HTTP/WebSocket route controllers. Depends on `mathjs`, and internal `intentGate`, `rateLimit`, and `fastPathGreeting` utilities.

**Pipeline Role:** Acts as a low-latency pre-processor/interceptor *before* main agent orchestration, saving compute and time on small talk.

**Surprising Coupling:** 
1. Oddly bundles math evaluation (`mathjs`) inside a conversational small-talk handler. 
2. Critically, despite a "strict latency guard" (`maxWorkMs`), it uses synchronous file reads (`fs.readFileSync`) and blocking `fetch` for dictionary enrichment on cache misses, risking event-loop stalls and violating its own non-blocking design.

---

## ARC-023 — learn — `innomcp-node/src/services/generalGate.ts` [moonshotai/Kimi-K2.6]
**Single responsibility:** Reference copy of hardcoded Thai general-intent fallback responses and text utilities, manually kept in sync with the live implementation.

**Key exported API:** `renderGeneralSmokeAnswer(userText)` — regex-based router for small-talk, Thai geography, and tech definitions; plus `renderThaiNumberText`, `renderGeneralFallbackMessage`, and `LOW_CONFIDENCE_FALLBACK_TEXT`.

**Upstream/downstream:** No production callers; the live code is inline in `routes/api/chat.ts` (`answerGeneralWithFastModel`). Only dependency is `logBoth` from `../utils/mcpLogger` (likely unused).

**Pipeline role:** Fast-model gate / catch-all responder that handles smoke tests, low-confidence fallbacks, and static knowledge before escalating to tool-based agents.

**Surprising coupling:** It is a manually-maintained shadow of live route code, creating stale-copy risk. It crams Thai geography, infrastructure health checks, NASA/WorldBank hints, and CS concepts (Docker, ML, RAG) into a single regex router, tightly coupling unrelated domains to one fallback module.

---

## ARC-024 — learn — `innomcp-node/src/services/healthAggregator.ts` [zai-org/GLM-5.1]
**Single Responsibility:** Aggregates system and custom service health checks into a single, 10-second cached status response.

**Key Exported API:** `HealthAggregator` singleton (`getInstance`, `registerChecker`, `check`) and types (`AggregatedHealth`, `HealthChecker`).

**Upstream Callers:** HTTP routers (`/health` endpoints) or container orchestrators (Kubernetes liveness/readiness probes).

**Downstream Deps:** Node.js `process` APIs, `setImmediate`/`setTimeout`, and external services (DBs, caches) that register custom checkers via `registerChecker`.

**Pipeline Role:** Out-of-band observability; ensures the node is alive and resourced enough to handle chat/agent traffic, but doesn't process pipeline data directly.

**Surprising Coupling:** Hardcoded Thai language strings in timeout/error handlers (e.g., `หมดเวลา`), tightly coupling infrastructure-level observability to a specific locale.

---

## ARC-025 — learn — `innomcp-node/src/services/hotRetriever.ts` [deepseek/deepseek-v4-pro]
**Module**: `hotRetriever.ts`  
**Single Responsibility**: Normalizes real-time tool results (weather, evidence, calculators) into structured `RetrievalFact` objects for live-data retrieval (“Hot RAG”).  

**Key Exported API**:  
- `RetrievalFact` interface  
- `normalizeWeatherFacts`, `normalizeEvidenceFacts`, `normalizeDeterministicFact`  
- `mergeRetrievalFacts`, `composeFactSummary`  

**Upstream Callers**: Tool-execution pipelines (e.g., weather, evidence, calculator tools) that return raw results.  
**Downstream Deps**: `answerContract` (imports `RetrievalSource`); answer composition layer that calls `composeFactSummary` to format facts for LLM prompting.  

**Role in Pipeline**: Post-tool execution, facts are normalized and merged, then summarized into a context block for agent answer generation.  

**Surprising Coupling**:  
- Hardcoded Thai province/ISP regex patterns in helpers (`extractWeatherEntities`, `extractISP`), tying a generic “hot retriever” to a specific locale.  
- Static confidence values baked per normalizer.  
- Mutable module-level counter for fact IDs — not isolated across invocations, making testing/multi-tenant reuse fragile.

---

## ARC-026 — learn — `innomcp-node/src/services/imageGenService.ts` [deepseek/deepseek-v4-flash]
**Single responsibility:** Image generation with provider failover (MDES Gateway → Pollinations.ai).  
**Key exported API:** `callImageGen(prompt, opts?) → ImageGenResponse` (async); `buildImageGenText(result) → string`; interfaces (`ImageGenResult`, `ImageGenError`).  
**Upstream callers:** Agent/chat MCP tool handlers invoking image generation.  
**Downstream deps:** External HTTP APIs (gateway, Pollinations), `mcpLogger`, env vars (`IMAGE_GEN_GATEWAY_URL`, `TOKEN`, `TIMEOUT_MS`).  
**Role in pipeline:** Converts user prompt → provider request → structured result with metadata (provider, model, timing). Supports prompt adaptation (English/Thai) via `opts.adaptedPromptEn`.  
**Surprising coupling:** Inline prompt cleaning logic (`cleanPrompt`) rather than delegated to a separate adapter; tight coupling to `mcpLogger` for structured logging.

---

## ARC-027 — learn — `innomcp-node/src/services/intentClassifier.ts` [Qwen/Qwen3.7-Max]
**Single Responsibility:** Deterministic, zero-LLM keyword routing of user messages into 16 predefined workflow intents.

**Key API:** `classifyIntent(message, toolHint?)` returning `ClassifyResult` (`intent`, `expectedToolUsage`, `reasons`). Exports `ChatIntent` union type.

**Upstream/Downstream:** Called by the **Conductor** to select execution workflows. Depends downstream on `./systemInventory` for system queries.

**Pipeline Role:** Phase C fast-path router. Intercepts raw input to bypass LLM latency for obvious queries (weather, math, greetings) and directs the agent's tool-selection strategy.

**Surprising Coupling:**
1. **Naturalness Guard:** The `expectedToolUsage` boolean is tightly coupled to a downstream guard detecting "Used tools: none" hallucination leaks.
2. **Forensic Heuristics:** Hardcoded regex disambiguates Thai/English homonyms (e.g., "traffic" as travel vs. network evidence), unexpectedly embedding deep forensic/officer domain logic directly into the generic router.

---

## ARC-028 — learn — `innomcp-node/src/services/leaderboardMetrics.ts` [moonshotai/Kimi-K2.6]
**Single responsibility:** In-memory accumulator for per-provider telemetry (latency, success, wins, quality) and derived score computation (health, efficiency, consistency).

**Key exported API:** `recordProviderCall`, `recordProviderWin`, `getProviderStats`, `getSparklineData`, `getIntentWinsSnapshot`.

**Upstream callers:** `motherDispatch` (after parallel fan-out) and synthesis winner-selection logic.

**Downstream deps:** `../utils/db` (`withDbConnection`) for fire-and-forget persistence; Node `setImmediate`.

**Pipeline role:** Feedback/learn pass for multi-provider routing—captures dispatch outcomes to inform future provider ranking and intent-based affinity.

**Surprising coupling:** Hardcoded MySQL `ON DUPLICATE KEY UPDATE` SQL inside the "in-memory" tracker, secretly coupling it to a specific DB schema/dialect; plus `process.env.NODE_ENV` branching in production persistence logic.

---

## ARC-029 — learn — `innomcp-node/src/services/mcpClient.ts` [deepseek/deepseek-v4-pro]
**Single responsibility**: Thin HTTP wrapper for invoking MCP tools on the innomcp-server-node, encapsulating retry/backoff (network/5xx only), timeouts, and health checks.

**Key exported API**: `McpClient` class (constructor with baseUrl, timeout, retries, fetch), `callTool<T>(name, params) → McpToolResult<T>`, `callBatch`, `isAvailable()`, and `getDefaultMcpClient()` singleton.

**Upstream callers**: *Not yet wired.* Intended to replace scattered `fetch` calls in `routes/api/chat.ts`; actual tool calls still use `IntelligentMCPClient` in `utils/mcp/mcpclient.ts`.

**Downstream deps**: Only the platform `fetch` (or injected impl) and `process.env.MCP_SERVER_URL`.

**Role in chat/agent pipeline**: Would serve as the uniform transport layer between agent logic and the external tool server, decoupling HTTP details from chat orchestration.

**Surprising coupling**: Exists as a scaffold alongside the live `IntelligentMCPClient`, creating a parallel, unused abstraction. Resilience logic (retries/timeouts) is baked in, which could conflict with higher-level retry policies once integrated.

---

## ARC-030 — learn — `innomcp-node/src/services/mdesModelCache.ts` [MiniMaxAI/MiniMax-M3]
**MDESModelCache** — single responsibility: cache and query the list of available models from a remote MDES Ollama endpoint, and select suitable ones per task.

**Exported API:** `MDESModel` interface, `MDESModelCache` class (`getModels`, `getModel`, `getModelFamilies`, `isModelAvailable`, `getBestModelForTask("thai"|"code"|"reasoning"|"fast")`, `warmUp`, `getStats`), and a shared `mdesModelCache` singleton.

**Upstream callers:** MCP server bootstrap (calls `warmUp` at startup); chat/agent pipeline that must pick a model — e.g., Thai NLU node uses `getBestModelForTask("thai")`, code-assist node uses `"code"`, planning node uses `"reasoning"`, lightweight classification uses `"fast"`. Health/diagnostic endpoints expose `getStats`.

**Downstream deps:** `fetch` against `MDES_OLLAMA_URL/api/tags` (Ollama tags schema), `process.env.MDES_OLLAMA_URL`. No DB, no other services.

**Pipeline role:** gatekeeper for model selection — sits before any LLM call, decoupling task-routing logic from the live Ollama registry and absorbing outages via stale-cache fallback.

**Surprising coupling:** task heuristics encode domain policy (Thai, code, ≥7B reasoning) directly inside the cache; `sizeValue` only recognizes the `…B` suffix, silently returning `Infinity` for missing/unknown sizes, which biases sorting. The exported `MDESModel` shape is Ollama-specific, leaking into all callers.