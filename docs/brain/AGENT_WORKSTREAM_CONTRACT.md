# Agent Workstream Contract (Public-Safe SSE Schema)

> The exact event payload contract that flows from `/api/chat/stream` to the frontend ThinkingPanel. **Every field listed here is safe for the user to see.** Anything not listed (especially raw model thoughts) MUST NOT appear in the SSE stream.

---

## Transport

- **HTTP method:** `POST /api/chat/stream`
- **Content-Type request:** `application/json`
- **Content-Type response:** `text/event-stream`
- **Headers (response):**
  - `Cache-Control: no-cache, no-transform`
  - `Connection: keep-alive`
  - `X-Accel-Buffering: no` (disable proxy buffering for true streaming)

## Request body

```ts
interface ChatStreamRequest {
  message: string;
  sessionId?: string;
  preferredMode?: "local" | "remote" | "hybrid";
  preferredProviderId?: string;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
  context?: { userTimezone?: string; locale?: "th" | "en" };
}
```

## Event envelope (every SSE message)

The server writes SSE messages in the standard `event: <name>\ndata: <json>\n\n` form. Every JSON payload conforms to:

```ts
interface AgentEvent {
  // Routing
  type: AgentEventType;
  runId: string;            // ULID — one per request
  messageId: string;        // ULID — assistant message identifier
  agentId?: AgentId;        // present for agent_*, tool_*, fact_found, draft_delta, critique
  role?: AgentRole;         // human-readable role label

  // Public-safe
  publicSummary: string;    // ≤ 120 chars, Thai, never private reasoning
  isSafeForUser: true;      // literal const — sentinel making schema-violators easy to grep

  // Optional metadata
  timestamp: string;        // ISO-8601
  confidence?: number;      // 0..1, optional
  sourceIds?: string[];     // RAG/tool source identifiers (no PII, no secrets)
  toolName?: string;        // present on tool_call_*
  provider?: string;        // provider id used by this step
  model?: string;           // model used by this step

  // Stream-specific payloads
  deltaText?: string;       // present only on draft_delta
  finalText?: string;       // present only on final_answer
  fallbackReason?: string;  // present only on fallback
}
```

## Event types (`AgentEventType`)

| Type | Direction | Required fields |
|---|---|---|
| `agent_run_started` | server→client | `type, runId, messageId, publicSummary, isSafeForUser, timestamp` |
| `route_selected` | server→client | `+ publicSummary` describing chosen route |
| `agent_started` | server→client | `+ agentId, role, publicSummary` |
| `agent_delta` | server→client | `+ agentId, publicSummary` (lightweight progress ping; **never** private text) |
| `tool_call_started` | server→client | `+ agentId, toolName, publicSummary` |
| `tool_call_finished` | server→client | `+ agentId, toolName, publicSummary, confidence?, sourceIds?` |
| `fact_found` | server→client | `+ agentId, publicSummary, confidence?, sourceIds?` |
| `draft_delta` | server→client | `+ deltaText` (the actual user-visible answer being streamed) |
| `critique` | server→client | `+ agentId="critic", publicSummary, confidence?` |
| `fallback` | server→client | `+ fallbackReason, publicSummary` |
| `final_answer` | server→client | `+ finalText, confidence?, sourceIds?` |
| `feedback_saved` | server→client | `+ publicSummary` (after `/api/chat/feedback` POST) |
| `error` | server→client | `+ publicSummary` (Thai friendly error, never stack trace) |

## Agent ids

`AgentId` enum: `conductor | concierge | tool-scout | weather-analyst | geo-planner | rag-agent | critic | stylist | broker | scribe`

`AgentRole` is a Thai display label, examples:
- `conductor` → `"ผู้กำกับงาน"`
- `concierge` → `"ผู้เรียบเรียงคำตอบ"`
- `tool-scout` → `"ผู้เลือกเครื่องมือ"`
- `weather-analyst` → `"นักวิเคราะห์อากาศ"`
- `geo-planner` → `"นักวางแผนพื้นที่/การเดินทาง"`
- `rag-agent` → `"ผู้สืบค้นความรู้"`
- `critic` → `"ผู้ตรวจสอบความถูกต้อง"`
- `stylist` → `"ผู้ขัดเกลาภาษาไทย"`

## Forbidden field names (schema-validator MUST reject)

The validator scans the SERIALIZED JSON for these keys and refuses to write the event:

```
privateThought, hiddenReasoning, chainOfThought, rawThought,
innerMonologue, secret, apiKey, password
```

The check is implemented as a substring scan of the JSON string before `res.write(...)`. This is the public-safe gate.

## Forbidden visible substrings in `publicSummary`, `deltaText`, `finalText`

The naturalness guard runs after composition; if any of these appear and intent ≠ `map`, the Conductor sets `event: fallback` with a `fallbackReason: "map-placeholder-leak"` and re-runs the Stylist:

```
Weather Map Placeholder
Deterministic Local Static Tile
placeholder (case-insensitive standalone word)
ข้อมูลไม่ครบสำหรับการแสดงแผนที่
Used tools: none   (when expectedToolUsage = true)
```

## Heartbeat & timeout

- Server sends a comment line `: heartbeat\n\n` every 15 s during long agent steps so proxies don't close idle connections.
- Client closes the SSE if no event in 60 s (configurable).

## Example wire format (excerpt)

```
event: agent_run_started
data: {"type":"agent_run_started","runId":"01HX...","messageId":"01HX...","publicSummary":"เริ่มประมวลคำขอ","isSafeForUser":true,"timestamp":"2026-05-03T12:00:00Z"}

event: route_selected
data: {"type":"route_selected","runId":"01HX...","messageId":"01HX...","publicSummary":"เลือกเส้นทางวางแผนหลายปัจจัย: อากาศ+การเดินทาง","isSafeForUser":true,"timestamp":"2026-05-03T12:00:00Z"}

event: agent_started
data: {"type":"agent_started","runId":"01HX...","messageId":"01HX...","agentId":"weather-analyst","role":"นักวิเคราะห์อากาศ","publicSummary":"กำลังประเมินความเสี่ยงฝนรายภาค","isSafeForUser":true,"timestamp":"..."}

event: draft_delta
data: {"type":"draft_delta","runId":"01HX...","messageId":"01HX...","deltaText":"ขออนุญาตเสนอแนวทางก่อนครับ ","isSafeForUser":true,"timestamp":"..."}

event: final_answer
data: {"type":"final_answer","runId":"01HX...","messageId":"01HX...","finalText":"...","confidence":0.78,"sourceIds":["tmd:rain-mar","gov:roads-2025"],"isSafeForUser":true,"timestamp":"..."}
```

## Versioning

Schema version: `1.0.0`. Future additions append to the type union. **Removing or renaming an existing field is a breaking change** that requires bumping to 2.x and a migration of the frontend reader.
