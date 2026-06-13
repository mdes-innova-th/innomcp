<!-- cc-team deliverable
 group: G2 (archmap division)
 member: ARC-029 role=learn model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1477,"completion_tokens":825,"total_tokens":2302,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":561,"image_tokens":0},"cache_creation_input_tokens":0} | 13s
 generated: 2026-06-13T12:00:51.529Z -->
**Single responsibility**: Thin HTTP wrapper for invoking MCP tools on the innomcp-server-node, encapsulating retry/backoff (network/5xx only), timeouts, and health checks.

**Key exported API**: `McpClient` class (constructor with baseUrl, timeout, retries, fetch), `callTool<T>(name, params) → McpToolResult<T>`, `callBatch`, `isAvailable()`, and `getDefaultMcpClient()` singleton.

**Upstream callers**: *Not yet wired.* Intended to replace scattered `fetch` calls in `routes/api/chat.ts`; actual tool calls still use `IntelligentMCPClient` in `utils/mcp/mcpclient.ts`.

**Downstream deps**: Only the platform `fetch` (or injected impl) and `process.env.MCP_SERVER_URL`.

**Role in chat/agent pipeline**: Would serve as the uniform transport layer between agent logic and the external tool server, decoupling HTTP details from chat orchestration.

**Surprising coupling**: Exists as a scaffold alongside the live `IntelligentMCPClient`, creating a parallel, unused abstraction. Resilience logic (retries/timeouts) is baked in, which could conflict with higher-level retry policies once integrated.
