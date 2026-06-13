<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D032 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1696,"completion_tokens":2826,"total_tokens":4522,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2256,"image_tokens":0},"cache_creation_input_tokens":0} | 54s
 generated: 2026-06-13T11:24:59.149Z -->
- **`AgentEventType`**
  - **Purpose:** Defines the allowed string literals for agent SSE event types flowing to the frontend ThinkingPanel.
  - **Caveat:** Must strictly match the event types handled by the frontend UI and the runtime gate in `eventGuard.ts`.

- **`AgentId`**
  - **Purpose:** Defines the allowed string literals identifying specific agents within the multi-agent system.
  - **Caveat:** Used to map to Thai role labels and track agent-specific execution contexts.

- **`AGENT_ROLE_LABEL_TH`**
  - **Purpose:** Maps each `AgentId` to its corresponding Thai display label for UI rendering.
  - **Caveat:** Must be kept strictly in sync with the `AgentId` union type to satisfy TypeScript's `Record` constraint.

- **`AgentEvent`**
  - **Purpose:** Defines the public-safe SSE event schema sent from the `/api/chat/stream` endpoint to the frontend.
  - **Caveat:** All fields must be safe for user visibility. Raw model thoughts or unsafe data must never be included; `isSafeForUser` must always be strictly `true`.

- **`SCHEMA_VERSION`**
  - **Purpose:** Specifies the current semantic version of the agent event contract schema.

- **`validateAgentEvent`**
  - **Purpose:** Performs a lightweight runtime shape validation on an unknown object to ensure it conforms to the `AgentEvent` interface.
  - **@param:** `ev` - The unknown object to validate.
  - **@returns:** `null` if the event is well-formed, or a string describing the first validation violation.
  - **Caveat:** Only checks structural shape, basic constraints (e.g., string lengths, enum values), and type-specific required fields (e.g., `deltaText` for `draft_delta`). It does *not* perform the public-safe content scan, which is handled separately by `eventGuard.ts`.

- **`newEnvelope`**
  - **Purpose:** Constructs a base `AgentEvent` envelope pre-populated with standard metadata, an ISO timestamp, and safety flags.
  - **@param:** `opts` - Configuration object containing `runId`, `messageId`, `type`, `publicSummary`, and an optional `agentId`.
  - **@returns:** A partially populated `AgentEvent` object with `isSafeForUser` set to `true`.
  - **Caveat:** The caller must still populate payload-specific fields (like `deltaText` or `toolName`). Automatically resolves and injects the Thai `role` label if `agentId` is provided.
