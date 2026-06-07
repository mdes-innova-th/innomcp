# Phase 8.1: Answer Quality Lock (UI-real Thai)

## 1. Quality Policy

Outputs from the system must feel natural, concise, and natively Thai. The LLM or deterministic renderer must NOT sound like a robot translating raw JSON. It must use proper terminology suited for the UI.

## 2. Required Phrasing & Structure

### GEO (Geography)

- **Constraint:** Must not return generic fallback text if a specific district/province is found.
- **Phrasing:** Use `เขต` instead of `อำเภอ` when the province is `กรุงเทพมหานคร`.
- **Ambiguity:** If multiple results are found, prompt the user gracefully: "ระบุชื่อพื้นที่ซ้ำกันหลายแห่ง กรุณาระบุจังหวัดเพิ่มเติม เช่น สตึก บุรีรัมย์".

### WX (Weather)

- **Constraint:** "No placeholder weather" rule. Cannot say "อุณหภูมิ 25-30 องศา" if the data is missing. Must report exactly what is returned by the Weather Pipeline.
- **Phrasing:** Use bullet points for multi-district queries (e.g., หลักสี่ + ลาดกระบัง). Include headers marking the context.
- **Failures:** If no data is available in the grid, output: "ขออภัย ไม่พบข้อมูลสภาพอากาศสำหรับพื้นที่ตารางกริดที่ระบุ".

### EVI (Evidence)

- **Constraint:** Must explicitly distinguish between "Yesterday" and "Today".
- **Phrasing:** Must include a top ISP breakdown when counts are requested by ISP, formatted as a numbered list.
- **Failures:** `MISSING_DETECT_DB_CREDS` must gracefully output "ยังไม่เชื่อมต่อฐานข้อมูล" rather than a hard system error or raw exception string.

### General (GeneralGate)

- **Constraint:** Responses must be strictly under the LLM fast-budget timeout constraint (e.g., 5 seconds).
- **Phrasing:** Must be polite, starting with empathetic/acknowledging words when refusing to perform tasks outside of its scope, but strictly limited to 2-5 sentences outlining the explanation (e.g., Docker, RAG).
