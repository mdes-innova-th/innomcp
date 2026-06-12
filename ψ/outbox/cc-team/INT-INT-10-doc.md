<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-10 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":83,"completion_tokens":3276,"total_tokens":3359,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2713,"image_tokens":0},"cache_creation_input_tokens":0} | 61s
 generated: 2026-06-12T03:49:50.973Z -->
# Architecture

The `innomcp-node` backend utilizes a strict layered architecture designed for modularity, testability, and high throughput. The system is divided into three primary tiers: Routes (API layer), Services (business logic), and Providers (external integrations and data access). This separation of concerns ensures that HTTP handling remains decoupled from core logic and external API dependencies.

```text
[ Client Request ]
       │
       ▼
┌─────────────────┐
│     Routes      │  <-- API Endpoints & Validation
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Services     │  <-- Business Logic & Orchestration
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Providers     │  <-- LLM APIs, Databases, Cache
└─────────────────┘
```

## Key Services

The service layer orchestrates core operations through specialized modules:

* **`fastPathHandler`**: Optimizes low-latency requests by bypassing heavy middleware for simple, cacheable, or pre-validated queries, ensuring rapid response times for frequent operations.
* **`providerManager`**: Acts as the central registry and router for external LLM and tool providers. It handles load balancing, fallback routing, and API key rotation across multiple AI models.
* **`healthAggregator`**: Continuously monitors the status of all registered providers and internal subsystems, aggregating metrics to expose real-time health checks and trigger automated failovers when degradation is detected.

## Chat Message Flow

The lifecycle of a chat message follows a deterministic path from ingestion to response:

1. **Ingestion**: The client sends a POST request to the `/chat` route. The route layer validates the payload schema, enforces rate limits, and extracts authentication tokens.
2. **Routing & Optimization**: The request is passed to the service layer. The `fastPathHandler` checks for cached responses or simple intents. If a cache hit occurs, it returns immediately.
3. **Orchestration**: For complex queries, the service layer invokes the `providerManager` to select the optimal LLM provider based on current health metrics (fetched from the `healthAggregator`) and routing rules.
4. **Execution**: The selected provider processes the prompt, applying any necessary context injection or tool-use parsing, and streams generated tokens back through the service layer.
5. **Response**: The route layer formats the streamed tokens into Server-Sent Events (SSE) for real-time UI updates or a standard JSON response, delivering the final message back to the client.
