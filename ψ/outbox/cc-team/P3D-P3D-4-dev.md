<!-- cc-team deliverable
 group: P3D (Phase 3.4 â€” Smoke suite: hello round-trip + WS reconnect + provider-select)
 member: P3D-4 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":80,"completion_tokens":2406,"total_tokens":2486,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":949,"image_tokens":0},"cache_creation_input_tokens":0} | 45s
 generated: 2026-06-12T03:43:32.023Z -->
# Phase 3 Integration Test Plan: innomcp-node Recovery

**File Path:** `tests/recovery/P3-INTEGRATION-PLAN.md`  
**Target Framework:** TypeScript (Vitest/Jest)  
**Phase Focus:** System resilience, connection recovery, input validation, and state observability.

---

## Scenario 1: Hello Chat (Baseline Connectivity)

Validates the end-to-end TypeScript client-to-backend communication pipeline under normal operating conditions.

### Pre-conditions
* The `innomcp-node` backend server is running and listening on the configured test port.
* Valid LLM provider API keys are injected into the test environment variables.
* The TypeScript test client is initialized and authenticated.

### Steps
1. Initialize the TS integration test suite and spawn the backend process via `child_process`.
2. Instantiate the MCP client and establish a WebSocket/HTTP connection to the backend.
3. Send a standard text payload: `{ "role": "user", "content": "hello" }`.
4. Await the streaming or synchronous response from the backend.
5. Assert the response payload structure and content.

### Expected Result
* The client successfully connects without throwing connection errors.
* The backend returns a valid, coherent greeting response (HTTP 200 / WS message).
* The response object strictly matches the expected TypeScript interface (e.g., `ChatResponse`).
* No unhandled exceptions or error logs are emitted by the backend process.

---

## Scenario 2: Backend Kill + Banner (Connection Recovery)

Validates the client's ability to detect abrupt backend termination, display the appropriate recovery UI/CLI banner, and gracefully reconnect.

### Pre-conditions
* Backend and client are running and actively connected.
* The client's reconnection policy and banner display logic are enabled.

### Steps
1. Establish a persistent connection between the TS client and the backend.
2. Retrieve the backend Process ID (PID) from the test harness.
3. Forcefully terminate the backend process using `process.kill(pid, 'SIGKILL')`.
4. Monitor the client's standard output (or state events) for the disconnect banner.
5. Restart the backend process using the test harness.
6. Monitor the client for reconnection success and banner clearance.

### Expected Result
* Upon `SIGKILL`, the client detects the socket closure within the configured timeout.
* The client emits the exact recovery banner string (e.g., `[!] Connection lost. Attempting to reconnect...`).
* The client does not crash or throw unhandled promise rejections during the disconnect.
* Once the backend is restarted, the client automatically reconnects.
* The recovery banner is cleared/replaced with a success message (e.g., `[✓] Reconnected.`).

---

## Scenario 3: Health Check (Subsystem Observability)

Validates the backend's internal health monitoring and its ability to report the status of critical dependencies.

### Pre-conditions
* The backend server is running.
* Mock or real instances of required dependencies (Database, Redis, LLM Provider) are accessible to the backend.

### Steps
1. Send an HTTP GET request to the backend's `/health` (or `/api/v1/health`) endpoint using a TS HTTP client (e.g., `axios` or `supertest`).
2. Parse the JSON response body.
3. Temporarily disable the mock database/LLM provider and send a second health check request.

### Expected Result
* **First Request:** Returns HTTP 200 OK. The JSON payload indicates `"status": "healthy"` and all subsystems (db, cache, llm) report `"up": true`.
* **Second Request:** Returns HTTP 503 Service Unavailable. The JSON payload indicates `"status": "degraded"` or `"unhealthy"`, specifically flagging the disabled subsystem as `"up": false` while others remain healthy.
* Response payloads strictly conform to the `HealthCheckResponse` TypeScript type.

---

## Scenario 4: Provider Display (Metadata & Routing)

Validates that the backend correctly routes requests to the configured LLM provider and accurately surfaces provider metadata to the client.

### Pre-conditions
* The backend is configured with a specific primary provider (e.g., `openai:gpt-4o` or `anthropic:claude-3-sonnet`).
* The client is configured to request and display provider metadata.

### Steps
1. Send a chat completion request with the `include_metadata: true` flag in the TS client payload.
2. Intercept the response stream/payload.
3. Extract the `provider` and `model` fields from the response metadata.
4. Send a second request dynamically overriding the provider via the client configuration (if supported) and repeat the extraction.

### Expected Result
* The first response includes a metadata object where `provider` and `model` exactly match the backend's default configuration.
* The client successfully parses and displays this metadata without type errors.
* If dynamic routing is used in step 4, the returned metadata accurately reflects the overridden provider/model.
* No fallback or default values are erroneously returned when a specific provider is explicitly requested.

---

## Scenario 5: Gibberish Rejection (Input Validation & Safety)

Validates the backend's input sanitization, validation pipelines, and graceful error handling when subjected to malformed or adversarial prompts.

### Pre-conditions
* The backend server is running with input validation middleware (e.g., Zod schemas) and safety filters active.
* The TS client is ready to send raw, un-sanitized payloads.

### Steps
1. Construct an array of invalid payloads:
   * Pure gibberish: `"asdf jkl; @#$% ^&* zxcv qwer"`
   * Malformed JSON/TypeScript objects (missing required fields).
   * Excessively long strings exceeding the maximum token/character limit.
2. Iterate through the array, sending each payload to the chat endpoint.
3. Capture the HTTP status codes and error response bodies for each request.
4. Verify the backend process remains active and memory usage is stable after the barrage.

### Expected Result
* **Malformed Objects:** Return HTTP 400 Bad Request with a structured validation error (e.g., Zod `ZodError` formatted as JSON).
* **Gibberish/Safety:** Return HTTP 422 Unprocessable Entity or 400 Bad Request with a clear rejection message (e.g., `"Prompt rejected: Invalid input format"`), without invoking the LLM API.
* **Length Limit:** Return HTTP 413 Payload Too Large or 400 Bad Request indicating the input exceeds maximum length.
* The backend process does not crash, hang, or leak memory. Subsequent valid requests (Scenario 1) still process successfully.
