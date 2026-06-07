# Phase 7.3 Quality - Patch Pack (For Vitcup)

## Triage Insights & Root Causes

1. **GEO trivia leak**: `thai_geo_tool` hardcodes the response suffix "อยู่ภาค..." instead of resolving the full administrative hierarchy (Province > District > Sub-district).
2. **Weather test-mode leak**: `fastPathHandler.ts` contains E2E testing stubs (e.g., "หมายเหตุ: ...เพื่อการทดสอบระบบ") with overly broad regexes that hijack valid production weather queries.
3. **Evidence missing-creds & ISP breakdown**: `evidenceTool.ts` aborts with `MISSING_DETECT_DB_CREDS` instead of providing a mocked fallback. The ISP breakdown intent exists but needs mock data support when creds are absent.

---

## Required Code Changes

### 1. `innomcp-node/src/utils/mcp/tools/thai_geo_tool.ts`

- **Function/Location**: The main lookup logic / formatting section.
- **Action**:
  - Stop appending "อยู่ภาค...".
  - Normalize and return the full administrative path logically: `Province > District > Sub-district` (e.g., "กรุงเทพมหานคร เขตหลักสี่").
  - Add logic to clarify administrative mismatches (e.g., "แขวง" vs "ตำบล", "เขต" vs "อำเภอ").

### 2. `innomcp-node/src/services/fastPathHandler.ts`

- **Function/Location**: Regex blocks matching Weather patterns (around line 535-600).
- **Action**:
  - Condition these stubs behind `process.env.NODE_ENV === 'test'` or `process.env.SMOKE_MODE === '1'`.
  - Ensure real weather queries pass through the fast-path undisturbed to hit the actual `WeatherPipeline`.

### 3. `innomcp-node/src/utils/mcp/tools/evidenceTool.ts`

- **Function/Location**: `assertDetectDbCreds` and `handleEvidenceTool`.
- **Action**:
  - Instead of returning `ok: false, code: "MISSING_DETECT_DB_CREDS"`, return a mocked data payload when DB credentials are not set.
  - For `intent === "evidence_records_yesterday_by_isp_top"`, ensure the fallback returns a total count and a mock ISP breakdown.

---

## Expected Behavior (Test Cases)

1. **Query**: `"จังหวัดกรุงเทพ หลักสี่ อำเภอหลักสี่"`
   - **Expected**: ควรตอบในทำนอง "กรุงเทพมหานคร เขตหลักสี่ (กรุงเทพมหานครใช้คำว่า เขต ไม่ใช่อำเภอ)" + ถามกลับ 1 ข้อถ้าจำเป็น (เช่น "ต้องการให้ค้นหาสถานที่ใดในเขตหลักสี่เพิ่มเติมไหมครับ?")
   - **Constraint**: ห้ามตอบ trivia "อยู่ภาคกลาง".

2. **Query**: `"กรุงเทพ หลักสี่ และลาดกระบังฝนตกไหม แบบละเอียด"`
   - **Expected**: ต้องตอบพยากรณ์อากาศแบบละเอียดจาก WeatherPipeline (TMD/NWP) จริง.
   - **Constraint**: ห้ามมีหลุดคำว่า “โหมดทดสอบ” หรือตัดจบผ่าน fastPath แบบจำลอง.

3. **Query**: `"เมื่อวานหลักฐานเข้าแยกตาม ISP ใครมากสุด"`
   - **Expected**: ยอดรวมเมื่อวาน + รายชื่อ ISP ที่ส่งข้อมูลมากที่สุด (Breakdown).
   - **Constraint**: ถ้า DB ไม่พร้อม (Creds หาย) ต้อง Fallback เป็นข้อมูลจำลอง (Mock) และบอก Limitation สั้น ๆ โดยไม่พ่น `ERR:MISSING_DETECT_DB_CREDS` แบบโต้ง ๆ.

---

## Security Notes

- **SQL Parameterization**: All new queries in `evidenceTool.ts` MUST use parameterized inputs (`?`). No string concatenation for SQL statements.
- **Aggregation Only**: Evidence queries MUST only return `.count`, `SUM()`, or `GROUP BY` aggregates.
- **No Raw Data Leak**: Do NOT return raw rows or PII (e.g., individual IP addresses, specific user logs) in the LLM context or standard logs.
