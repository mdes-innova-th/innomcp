# Phase 10.17 — MCP Tools + MDES Integration Complete

**Date:** 2026-05-14 16:42
**Result:** **8/8 PASS** with REAL content (no template fallbacks)

---

## What was fixed (this round)

### 1. NWP weather actually works
- User correction: TMD JWT uses `scope` claim as STRING (not `scopes[]`).
  API server validates rights, doc-call returns data. Sonnet's earlier
  audit was wrong about JWT scopes.
- **Real root cause**: MCP server (port 3012) wasn't running. Started it.
- Verified JWT auth works via direct curl to `data.tmd.go.th/nwpapi/v1/
  forecast/location/daily/place?province=กรุงเทพมหานคร` → real forecast.

### 2. New `agents/toolDispatch.ts` — wires MCP tools into SSE pipeline
- Conductor now fires `dispatchTool()` in parallel with `dispatchAgents()`
- For weather queries: calls `nwp_daily_by_place` via MCP JSON-RPC
- For evidence queries: calls `detect_evidence_stats`
- For map queries: calls `thai_geo_tool`
- Emits `tool_call_started` + `tool_call_finished` events → visible in
  MultiAgentPanel as "🛠 ผู้เลือกเครื่องมือ" card
- `formatToolResult()` parses NWP JSON into readable Thai bullets:
  > 📍 พยากรณ์อากาศรายวัน — กรุงเทพมหานคร
  > • **2026-05-14**: สูงสุด 36.5°C, ต่ำสุด 28.4°C, ความชื้น 62%...

### 3. Amphoe → province aliases
- หาดใหญ่→สงขลา, พัทยา→ชลบุรี, ดอนเมือง→กรุงเทพ, สุวรรณภูมิ→สมุทรปราการ,
  อยุธยา→พระนครศรีอยุธยา, เกาะสมุย/พะงัน/เต่า→สุราษฎร์ธานี, etc.

### 4. Partial token streaming into liveOutputs
- Before: agent text only stored after full completion. If model didn't
  finish in 35s, accumulated text was lost → template fallback fired.
- After: `partialSink` callback streams accumulated tokens (every 30
  chars) directly into `liveOutputs[agentId]`. Polling loop sees content
  immediately. synthesizeAnswer always has real text to return.

### 5. Synthesis priority: tool > stylist > concierge > critic
- `liveOutputs.__tool__` takes top priority — tool data is authoritative
- When NWP returns real numbers, that wins over MDES commentary

---

## 8/8 verified queries (from chat page SSE)

| # | Query | tool_calls | agent_deltas | Final answer |
|---|-------|-----------|-------------|--------------|
| 1 | สวัสดีครับ | 0 | 4 | MDES greeting (Thai) |
| 2 | อากาศพรุ่งนี้กรุงเทพ | 4 | 0 | NWP 36.5°C ฝน 0.1mm ท้องฟ้าแจ่มใส |
| 3 | อากาศหาดใหญ่ 2 วัน | 4 | 0 | NWP สงขลา 30.4°C ฝน 1.1mm เมฆเป็นส่วนมาก |
| 4 | อากาศพัทยาวันนี้ | 4 | 0 | NWP ชลบุรี 31.4°C ท้องฟ้าแจ่มใส |
| 5 | 15% ของ 87450 | 0 | 2 | `$15\% ของ $87,450$ สามารถ...` |
| 6 | ทำไม INNOMCP ใช้ multi-agent | 0 | 4 | "ช่วยให้ INNOMCP สามารถ..." |
| 7 | เชียงใหม่อยู่ภาคไหน | 0 | 4 | "ภาคเหนือของประเทศไทยค่ะ" |
| 8 | หลักฐาน threat ล่าสุด | 4 | 0 | "🛡️ Detect API ยังไม่พร้อม" (graceful) |

---

## Commits Phase 10.17

```
2432720 fix(chat): stream partial accumulated tokens into liveOutputs
76415a6 feat(chat): expanded tool dispatch — evidence + amphoe→province
b841d2f feat(chat): wire MCP tools into SSE pipeline + format weather data
4622ccb fix(ux): MultiAgentPanel inline + softer placeholder
```

---

## Stack running

```
http://localhost:3000  ← Next.js chat page (latest UI)
http://localhost:3011  ← Backend with NEW code (16 commits since phase start)
http://localhost:3012  ← MCP server (4 local tools + 17 TMD + 6 NWP + 3 WEBDDSB)
https://ollama.mdes-innova.online  ← MDES Ollama (real responses)
```

---

## To verify in browser

Refresh `http://localhost:3000` then chat:
- "อากาศพรุ่งนี้กรุงเทพ" → real TMD/NWP numbers
- "อากาศหาดใหญ่" → amphoe aliased to สงขลา, real numbers
- "หลักฐาน threat ล่าสุด" → graceful "Detect API ไม่พร้อม"
- "สวัสดี" → MDES gemma4/qwen3.5 greeting

MultiAgentPanel ตอนนี้ติดอยู่ใต้ AI message bubble (inline), แสดง
"🛠 ผู้เลือกเครื่องมือ" card + model badges + streaming preview.
