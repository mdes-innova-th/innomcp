# Phase 8.4: Weather Resilience (Deterministic Routing Unchanged)

## 1. Resilience Philosophy

The routing logic remains fully deterministic. The LLM is still strictly a renderer. The focus of Phase 8.4 is the end-to-end resilience of the Weather Pipeline under unstable upstream conditions.

## 2. Abort Signaling

When a client drops the connection (e.g., closing the WebSocket or HTTP stream prematurely before the LLM fast-budget expires), the system MUST gracefully cascade the abort signal:

1. API Route -> HTTP Controller / WebSocket listener
2. Controller -> MCP Client `runDeterministicWeatherPipeline`
3. MCP Server -> Weather Tool Executor
4. Tool Executor -> `node-fetch` upstream TMD APIs

If the call is aborted, no further processing should occur, and the server thread must be released.

## 3. Upstream Call Minimization

- Remove redundant concurrent network fetches if the main payload can be resolved with a single request.
- Ensure that fallback mechanisms do not retry endlessly causing backend stalls. Limit the retry scope and gracefully yield `ERR:WX_TIMEOUT` or `ERR:WX_UPSTREAM_ERROR`.

## 4. Station Mapping Canonicalization

- Hardcode exact maps for tricky provinces (e.g., `กทม` -> `กรุงเทพมหานคร`, `เมืองพัทยา` -> `ชลบุรี` or explicitly mapped TMD station ID).
- Avoid relying on fuzzy matching for core administrative regions and rely strictly on the structured `admin_name`.

## 5. Professional Fallback Policy

All upstream failures must render securely.

- **Forbidden:** No leaked JSON, no `process.env` dumps in the chat bubble.
- **Pro Wording:** "ขออภัย ยังไม่สามารถดึงข้อมูลอากาศได้ในขณะนี้ (ERR:WX_ABORT)"
- **No Test Strings:** "โหมดทดสอบ", "อุณหภูมิ 30°C", "ความชื้น 70%" are banned in fallback strings.
