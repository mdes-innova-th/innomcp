# Phase 8.3: Answer Polish (Strict Formatting & Invariants)

## 1. Renderer-Only Invariant

The LLM serves strictly as a **Renderer**. It must NEVER make decisions about which tool to call, and it must NEVER fetch data, guess data, or perform math. It receives a structured payload and formats it into natural Thai suitable for the UI.

- No Tool Decisions.
- No Hallucination.
- No Extrapolation.

## 2. Forbidden Outputs

The rendered text must be pristine and professional.

- **No Placeholders:** Responses must never include hardcoded test strings like `อุณหภูมิ 25-30 องศา` or `โอกาสฝน 20%`.
- **No Env Leaks:** Responses must never include terms like `process.env`, `DETECT_DB_PASSWORD`, `host`, `port`, or `Authorization`.
- **No Developer Artifacts:** No raw JSON, no Markdown code fences (e.g. ```json), no DB query dumps.
- **No Test Strings:** "โหมดทดสอบ", "เพื่อการทดสอบระบบ" are strictly forbidden.

## 3. Strict Formatting Contracts

### GEO (Geography) Contract

- **NOT_FOUND Shape:** `ERR:GEO_NOT_FOUND` -> "ขออภัย ไม่พบข้อมูลพื้นที่ที่ระบุ กรุณาตรวจสอบการสะกด"
- **AMBIGUOUS Shape:** `ERR:GEO_AMBIGUOUS` -> "ระบุชื่อพื้นที่ซ้ำกันหลายแห่ง กรุณาระบุจังหวัดเพิ่มเติม เช่น [ตัวอย่าง1, ตัวอย่าง2]"
- **SUCCESS Shape:** Must include proper administrative prefixes (e.g., `เขต` for Bangkok, `อำเภอ` for others).

### WX (Weather) Contract

- **TWO-TARGET Shape:** For queries like "หลักสี่และลาดกระบัง", the output must strictly contain two bulleted sections with clear headers (`- เขตหลักสี่`, `- เขตลาดกระบัง`) detailing Rain %, Temp, and Humidity.
- **UPSTREAM ERROR Shape:** `ERR:WX_UPSTREAM` -> "ขออภัย ยังไม่สามารถดึงข้อมูลอากาศได้ในขณะนี้"

### EVI (Evidence) Contract

- **YESTERDAY + ISP Shape:** Must output a dashboard-like summary containing:
  - `- รวม: [count] รายการ`
  - `- แยกตาม ISP (Top 3):` (numbered list)
  - `- ISP มากที่สุด: [isp] ([count])`
- **MISSING CREDS Shape:** `ERR:MISSING_DETECT_DB` -> "สรุปหลักฐานเมื่อวานนี้ (ยังไม่พร้อมเชื่อมต่อฐานข้อมูล)..." (Must degrade gracefully without exposing the DB connection error).

## 4. Failure Taxonomy (ERR:\*)

Internal error codes must be mapped to user-friendly vernacular.

- `ERR:WX_TIMEOUT`
- `ERR:WX_PROVINCE_MISSING`
- `ERR:WX_UPSTREAM_ERROR`
- `ERR:GEO_AMBIGUOUS`
- `ERR:GEO_NOT_FOUND`
- `ERR:EVI_MISSING_CREDS`
- `ERR:EVI_SCHEMA_MISMATCH`
