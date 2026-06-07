# Phase 7.4: General Intelligence Hardening - Specification

## Objective

Implement a fast, deterministic `GeneralGate` to handle conversational and broad-knowledge queries _before_ the expensive God-Tier LLM tool selection process. This prevents latency spikes, hallucinated tool arguments, and unnecessary DB/API load when users ask general questions (e.g., "AI คืออะไร?", "สวัสดี", "สรุปข่าววันนี้ให้หน่อย").

## `GeneralGate` Rules

### 1. Qualification (What is "General"?)

A query is routed to `GeneralGate` if it meets these positive signals AND does NOT trigger any negative signals.

**Positive Signals:**

- Short, conversational greetings or questions (length <= 80 chars).
- Questions ending in question markers (e.g., "?", "ไหม", "หรือ", "ได้ไหม", "ทำยังไง", "อย่างไร") with length <= 160 chars.
- Explicit knowledge-seeking keywords: "คืออะไร", "อธิบาย", "สรุป", "แตกต่าง", "เปรียบเทียบ", "ทำไม", "แนวทาง", "ขั้นตอน", "วิธี", "ตัวอย่าง", "แนะนำ".

**Negative Signals (Do NOT route to GeneralGate):**

- **Weather Intents**: Contains "อากาศ", "ฝน", "พยากรณ์", "อุณหภูมิ", "ความชื้น", "weather", "forecast".
- **GEO Intents**: Contains "เขต", "แขวง", "อำเภอ", "ตำบล", "รหัสไปรษณีย์", "พิกัด", "lat", "lon".
- **Evidence/Officer Intents**: Contains "machine", "isp", "record", "nip", "url", "evidence", "หลักฐาน", "วิดีโอ".
- **DateTime Intents**: Contains "กี่โมง", "เวลา", "วันที่", "เดือนอะไร", "now", "time".
- **Math/Calc Intents**: Contains math operators (+, -, \*, /) or "คำนวณ", "บวก", "ลบ", "คูณ".
- **URLs**: Contains "http://", "https://", "www.".

### 2. General LLM Execution & Budget

- **Model**: Use `ollamaFastModel` (the fastest available internal model).
- **Latency Budget**: Configurable via `GENERAL_LLM_BUDGET_MS` (default: 5000ms, max 30000ms, min 250ms).
- **Prompting Guardrails**:
  - "ตอบเป็นภาษาไทย สุภาพ กระชับ 2-5 ประโยค"
  - "ถ้าไม่แน่ใจหรือคำถามกว้าง ให้ถามกลับ 1 คำถามเพื่อขอรายละเอียด"
  - "ห้ามเดาตัวเลข/สถิติ/เหตุการณ์ปัจจุบันที่ไม่ชัวร์"
  - "ห้ามเอ่ยถึง tool/MCP/ระบบภายใน"

### 3. Fallback Logic

If `answerGeneralWithFastModel` exceeds the latency budget or errors out, it must gracefully fallback to a pre-defined Thai string WITHOUT leaking internal errors (no `ERR:TIMEOUT` visible to user).

- **Fallback Copy**: `"ขออภัย ตอนนี้ตอบได้ไม่ทันเวลา ลองระบุคำถามให้แคบลงอีกนิด (เช่น เป้าหมาย/บริบท/ตัวอย่าง) แล้วผมจะสรุปให้สั้นๆ ได้ครับ"`

### 4. Smoke Test Mode (`SMOKE_MODE=1`)

To ensure E2E tests remain fast and deterministic, `GeneralGate` must intercept specific keywords and return static responses when both `SMOKE_MODE=1` and `x-smoke-run: 1` headers are present.

- "RAG" -> Returns static definition of RAG.
- "AI" + "คืออะไร" -> Returns static definition of AI.
- "KPI" / "OKR" -> Returns static definition of KPI/OKR.
- Any other general query in smoke mode -> Returns static default response.
- `PHASE74_FORCE_TIMEOUT` (in `NODE_ENV=test`) -> Forces the fallback copy to test timeout handling.

## Code Hotspots (Security & Architecture Review)

1. **`chat.ts` Gate Ordering**: `GeneralGate` must be positioned _after_ `fastPathChatMiddleware` (which handles immediate static greetings) but _before_ `WeatherGate`, `GeoGate`, and `OfficerMode` to catch simple queries early. However, the Negative Signals must be strictly evaluated to prevent swallowing actionable commands.
2. **`mcpClient.ts`**: Should not be invoked at all if `GeneralGate` resolves the intent.
3. **`fastPathHandler.ts`**: Ensure no leftover "test modes" leak into production; `GeneralGate` effectively replaces the need for many complex regex-based fast-paths by using a fast LLM.
