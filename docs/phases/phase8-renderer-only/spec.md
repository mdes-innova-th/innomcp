# Phase 8: LLM as Renderer Only - Specification

## 1. Policy: LLM as Renderer Only

The core philosophy of Phase 8 is that the LLM is strictly a text-formatting engine ("Renderer") for data that has already been precisely fetched, validated, and structured by the deterministic backend tools.

- The LLM **MUST NOT** perform complex logical deductions, math, or data retrieval.
- The LLM **MUST NOT** hallucinate fallback data or alter the semantics of the structured content provided to it.
- If the structured data is empty or indicates an error, the LLM must only format that error into a polite Thai response.

## 2. Renderer Contracts

### Weather Contract

- **Input:** JSON payload containing region/province/district name, temperature, rain probability, humidity, wind.
- **Output:** A concise, bulleted or short-paragraph summary.
- **Constraint:** Must explicitly mention the resolved district/province. Must not output generic "ขออภัย" unless the input explicitly states an error.

### GEO Contract

- **Input:** JSON payload with normalized address (province, district, subdistrict).
- **Output:** A direct answer joining the administrative levels (e.g., "กรุงเทพมหานคร เขตหลักสี่").
- **Constraint:** Must avoid trivia (e.g., "อยู่ภาคกลาง") unless specifically asked. Must handle ambiguities by listing top matches without hallucinating a single forced match.

### Evidence Contract

- **Input:** JSON payload with record counts, dates, and ISP breakdowns.
- **Output:** A direct numerical summary and top ISP highlight.
- **Constraint:** Must not invent missing DB columns or credentials. Must render the provided fallback text if `MISSING_DETECT_DB_CREDS` is passed.

### General Contract (`GeneralGate`)

- **Input:** Direct user query (bypassed tools).
- **Output:** A fast (under 5s budget), polite, 2-5 sentence Thai response.
- **Constraint:** Must ask for clarification if ambiguous. Must NOT mention "tool", "MCP", or "database".

## 3. Forbidden Outputs

- **Test-Mode Phrases:** "โหมดทดสอบ", "เพื่อการทดสอบระบบ"
- **Internal Variables:** Any mention of `process.env`, `.env`, `DETECT_DB_PASSWORD`, `host`, `port`.
- **Raw Formats:** Raw JSON blocks, raw DB rows, SQL queries, or stack traces.
- **System Internals:** Mentions of "God-Tier Router", "MCP", "Local Tool".

## 4. Error Taxonomy (ERR:CODE)

When tools fail, they must return a standard `ERR:CODE` to the LLM (or directly to the user if bypassed). The LLM's job is to render these cleanly.

- `ERR:MISSING_DETECT_DB_CREDS`: "ระบบยังไม่เชื่อมต่อฐานข้อมูลหลักฐาน กรุณาตั้งค่าเพื่อดูข้อมูลเชิงลึก"
- `ERR:MISSING_DATE_COLUMN`: "ไม่พบคอลัมน์วันที่ในฐานข้อมูลสำหรับช่วงเวลาที่ระบุ"
- `ERR:GEO_NOT_FOUND`: "ไม่พบข้อมูลพื้นที่ที่ระบุ กรุณาตรวจสอบการสะกด"
- `ERR:GEO_AMBIGUOUS`: "ระบุชื่อพื้นที่ซ้ำกันหลายแห่ง กรุณาระบุจังหวัดเพิ่มเติม"
- `ERR:WEATHER_TIMEOUT`: "ไม่สามารถดึงข้อมูลสภาพอากาศได้ทันเวลา กรุณาลองใหม่อีกครั้ง"
- `ERR:WEATHER_NO_DATA`: "ไม่มีข้อมูลสภาพอากาศสำหรับพื้นที่ตารางกริดที่ระบุ"
- `ERR:GENERAL_FAST_TIMEOUT`: "ขออภัย ตอนนี้ตอบได้ไม่ทันเวลา ลองระบุคำถามให้แคบลงอีกนิด..."
