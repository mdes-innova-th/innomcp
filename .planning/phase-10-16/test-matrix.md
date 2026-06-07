# INNOMCP Test Matrix — Phase 10.16
Generated: 2026-05-14 | Designer: Sonnet (test designer)

## Coverage map
| # | Category | Tool / Agent | Query (Thai) |
|---|----------|-------------|--------------|
| T1 | MCP: detect_evidence_stats | detect_evidence_stats | ค้นหาหลักฐานคดีล่าสุดในระบบมีกี่รายการ |
| T2 | MCP: thai_geo_tool | thai_geo_tool | จังหวัดเชียงใหม่อยู่ภาคอะไร มีอำเภอกี่อำเภอ |
| T3 | MCP: system_status_tool | system_status_tool | สถานะเครื่อง docker และ evidence db ตอนนี้เป็นอย่างไร |
| T4 | MCP: thaiKnowledgeTool | thaiKnowledgeTool | บอกข้อมูลพื้นฐานเกี่ยวกับประเทศไทยและภูมิศาสตร์ |
| T5 | Weather API | NWP/TMD weather | พยากรณ์อากาศพรุ่งนี้ที่กรุงเทพมหานครเป็นอย่างไร |
| T6 | Calculator | calculator | คำนวณ 15% ของ 87,450 บาทเท่ากับเท่าไหร่ |
| T7 | Datetime | datetime | วันนี้วันที่เท่าไหร่ และอีก 45 วันจะตรงกับวันอะไร |
| T8 | Greeting | concierge / direct | สวัสดีครับ ช่วยแนะนำตัวเองหน่อยได้ไหม |
| T9 | Complex planning | MDES multi-agent | วางแผนระบบรักษาความปลอดภัยสำหรับสถานีตำรวจ 3 จังหวัด |
| T10 | Code | direct / code agent | เขียน Python function ดึงข้อมูล JSON จาก REST API พร้อม error handling |

---

## Full test cases

### T1 — MCP: detect_evidence_stats
- **Query:** `ค้นหาหลักฐานคดีล่าสุดในระบบมีกี่รายการ`
- **Expected tool:** `detect_evidence_stats`
- **Trigger keywords:** หลักฐาน, คดี
- **Success criteria:**
  - Tool call to `detect_evidence_stats` appears in trace/logs
  - Response contains a numeric count or record list
  - No hallucinated data — answer sourced from tool result
  - Response in Thai

---

### T2 — MCP: thai_geo_tool
- **Query:** `จังหวัดเชียงใหม่อยู่ภาคอะไร มีอำเภอกี่อำเภอ`
- **Expected tool:** `thai_geo_tool`
- **Trigger keywords:** จังหวัด, อำเภอ, ภาค
- **Success criteria:**
  - Tool call to `thai_geo_tool` appears
  - Response states "ภาคเหนือ" for region
  - Response includes district count (25 อำเภอ)
  - No routing to thaiKnowledgeTool (geo-specific, not general knowledge)

---

### T3 — MCP: system_status_tool
- **Query:** `สถานะเครื่อง docker และ evidence db ตอนนี้เป็นอย่างไร`
- **Expected tool:** `system_status_tool`
- **Trigger keywords:** สถานะเครื่อง, docker, evidence db
- **Success criteria:**
  - Tool call to `system_status_tool` (NOT `detect_evidence_stats`)
  - Response includes docker container status (running/stopped)
  - Response includes DB connectivity status
  - Latency < 5s

---

### T4 — MCP: thaiKnowledgeTool
- **Query:** `บอกข้อมูลพื้นฐานเกี่ยวกับประเทศไทยและภูมิศาสตร์`
- **Expected tool:** `thaiKnowledgeTool`
- **Trigger keywords:** ประเทศไทย, ภูมิศาสตร์
- **Success criteria:**
  - Tool call to `thaiKnowledgeTool`
  - Response covers capital, area, region count, or border countries
  - Does NOT route to `thai_geo_tool` (general knowledge, not specific lookup)

---

### T5 — Weather API (NWP/TMD)
- **Query:** `พยากรณ์อากาศพรุ่งนี้ที่กรุงเทพมหานครเป็นอย่างไร`
- **Expected tool:** weather / NWP/TMD integration
- **Success criteria:**
  - Response includes temperature range (°C)
  - Response includes precipitation probability or condition (ฝน/แดด)
  - Date reference is tomorrow relative to today (2026-05-15)
  - Source attributed to TMD or NWP if displayed

---

### T6 — Calculator
- **Query:** `คำนวณ 15% ของ 87,450 บาทเท่ากับเท่าไหร่`
- **Expected tool:** calculator
- **Success criteria:**
  - Correct answer: 13,117.50 บาท
  - Answer shown in Thai with currency unit
  - No rounding error beyond 2 decimal places

---

### T7 — Datetime
- **Query:** `วันนี้วันที่เท่าไหร่ และอีก 45 วันจะตรงกับวันอะไร`
- **Expected tool:** datetime
- **Success criteria:**
  - Today = 14 พฤษภาคม 2569 (Buddhist Era) or 2026-05-14
  - +45 days = 28 มิถุนายน 2026 (2026-06-28)
  - Day-of-week stated correctly (Saturday)

---

### T8 — Greeting / Direct
- **Query:** `สวัสดีครับ ช่วยแนะนำตัวเองหน่อยได้ไหม`
- **Expected tool:** none (concierge / direct LLM reply)
- **Success criteria:**
  - No unnecessary tool call triggered
  - Response in Thai
  - System introduces itself as INNOMCP assistant
  - Response friendly and < 5 sentences

---

### T9 — Complex Planning (MDES multi-agent)
- **Query:** `วางแผนระบบรักษาความปลอดภัยสำหรับสถานีตำรวจ 3 จังหวัด`
- **Expected tool:** MDES concierge → critic → planner pipeline
- **Success criteria:**
  - Multi-agent trace shows concierge + at least one specialist (critic or planner)
  - Response includes structured plan sections (e.g., ภาพรวม, อุปกรณ์, งบประมาณ)
  - thai_geo_tool OR detect_evidence_stats invoked as sub-tool for context
  - Response >= 200 words with actionable steps

---

### T10 — Code Generation
- **Query:** `เขียน Python function ดึงข้อมูล JSON จาก REST API พร้อม error handling`
- **Expected tool:** direct LLM (code capability)
- **Success criteria:**
  - Returns valid Python code block
  - Uses `requests` or `httpx`
  - Includes try/except with HTTP error handling
  - Includes docstring or inline comments
  - No tool call to MCP tools (pure code generation)

---

## Routing conflict watchlist
These pairs share keywords and must route correctly:

| Ambiguous keyword | Correct tool | Wrong tool (must avoid) |
|------------------|-------------|------------------------|
| `สถานะเครื่อง` in system context | system_status_tool | detect_evidence_stats |
| `ภูมิศาสตร์` general | thaiKnowledgeTool | thai_geo_tool |
| `จังหวัด` + specific lookup | thai_geo_tool | thaiKnowledgeTool |
| `evidence db` infra query | system_status_tool | detect_evidence_stats |

---

## How to run
```bash
# Set smoke mode per project policy
SMOKE_MODE=1

# Run against local endpoint
curl -X POST http://localhost:3011/api/chat/mcp/tools \
  -H "Content-Type: application/json" \
  -d '{"message": "<query_here>", "sessionId": "test-matrix-run-1"}'
```

## Pass/fail threshold
- All 10 cases pass = green light for phase 10.16 release gate
- Any routing mismatch (wrong tool selected) = P1 bug, block release
- Calculation error or date error = P1 bug
- Response quality issues (T8, T9, T10) = P2, document and continue
