# Alias / Geo Lookup Test Summary

## 1. สรุปผลการทดสอบล่าสุด

- Frontend URL: `http://localhost:3000`
- Automation test: `innomcp-next/e2e/acceptance.spec.ts`
- Runner: Playwright (`chromium`, headed)
- Total tests executed: `95`
- Passed: `92`
- Failed: `3`
- Pass rate: `96.8%`

## 2. รายการความคืบหน้า (Checklist)

| หมวด | จำนวนรวม | ผ่าน | ไม่ผ่าน | สถานะ |
|---|---|---|---|---|
| CALCULATOR | 5 | ✅ 5 | 0 | ผ่าน |
| DATETIME | 3 | ✅ 3 | 0 | ผ่าน |
| WEATHER SUMMARY | 4 | ✅ 4 | 0 | ผ่าน |
| WEATHER PROVINCE | 4 | ✅ 4 | 0 | ผ่าน |
| WEATHER REGION | 4 | ✅ 4 | 0 | ผ่าน |
| WEATHER NATIONWIDE | 3 | ✅ 3 | 0 | ผ่าน |
| WEATHER 7-DAY | 3 | ✅ 3 | 0 | ผ่าน |
| WEATHER TABLE | 2 | ✅ 2 | 0 | ผ่าน |
| WEATHER WARNING | 2 | ✅ 2 | 0 | ผ่าน |
| SEISMIC | 2 | ✅ 2 | 0 | ผ่าน |
| HYDRO | 2 | ✅ 2 | 0 | ผ่าน |
| NWP | 3 | ✅ 3 | 0 | ผ่าน |
| CLIMATE NORMAL | 2 | ✅ 2 | 0 | ผ่าน |
| STATION DATA | 2 | ✅ 2 | 0 | ผ่าน |
| NASA | 3 | ✅ 3 | 0 | ผ่าน |
| WORLDBANK | 3 | ✅ 3 | 0 | ผ่าน |
| QR CODE | 1 | ✅ 1 | 0 | ผ่าน |
| EVIDENCE | 2 | ✅ 2 | 0 | ผ่าน |
| THAI KNOWLEDGE | 2 | ✅ 2 | 0 | ผ่าน |
| GENERAL | 2 | ✅ 2 | 0 | ผ่าน |
| FAST PATH | 2 | ✅ 2 | 0 | ผ่าน |
| WEATHER ALIAS | 4 | ✅ 4 | 0 | ผ่าน |
| ORCHESTRATION PROOF | 4 | ✅ 4 | 0 | ผ่าน |
| PLACEHOLDER MAP | 4 | ✅ 4 | 0 | ผ่าน |
| PERFORMANCE | 3 | ✅ 3 | 0 | ผ่าน |
| EXTENDED THAI KNOWLEDGE | 6 | ✅ 6 | 0 | ผ่าน |
| ANALYTICAL WEATHER | 3 | ✅ 3 | 0 | ผ่าน |
| GROUNDED CONTRACT | 3 | ✅ 3 | 0 | ผ่าน |
| INTELLIGENCE DISTRICT | 4 | ✅ 4 | 0 | ผ่าน |
| INTELLIGENCE ALIAS | 4 | 1 | 3 | ต้องแก้ |
| INTELLIGENCE TOOLS | 4 | ✅ 4 | 0 | ผ่าน |

## 3. งานที่ต้องแก้สำหรับ Programmer ต่อไป

### ปัญหาเฉพาะ
- `IA1 — ปากช่องอยู่จังหวัดอะไร`
- `IA2 — หัวหินอยู่จังหวัดอะไร`
- `IA4 — แม่สายอยู่จังหวัดอะไร`

### อาการ
- คำตอบ returned: `ไม่พบข้อมูลภูมิศาสตร์ที่ตรงกับคำค้นหา`
- ระบบไม่สามารถ resolve alias / district → province ได้
- เกิดที่ขั้นตอน geo lookup, ไม่ใช่ frontend rendering

## 4. Artifact สำหรับดีบั๊ก

- Screenshot และ trace: `innomcp-next/test-results/acceptance-INTELLIGENCE-ALIAS-*`
- Trace ใช้คำสั่ง:
  - `npx playwright show-trace <path-to-trace.zip>`

## 5. โค้ดที่น่าจะต้องแก้

### หลัก
- `innomcp-server-node/src/mcp/tools/thaiGeoTool.ts`
  - ที่ตั้งค่า seed data และ aliases: `THAI_GEO_SEED`
  - ที่สร้าง entity จังหวัด/อำเภอ ด้วย helper `prov(...)`
  - ฟังก์ชัน `sortMatches(...)` และการคำนวณคะแนน alias
  - ฟังก์ชัน `thaiGeoTool.execute(...)` ที่ออก `NOT_FOUND` หรือ fallback

### ปรับปรุงทดสอบ regression
- `innomcp-server-node/src/mcp/tools/thaiGeoTool.spec.ts`
  - เพิ่มกรณี `ปากช่อง`, `หัวหิน`, `แม่สาย`
  - ตรวจสอบว่า alias map คืนค่า `นครราชสีมา`, `ประจวบคีรีขันธ์`, `เชียงราย`

### อาจตรวจสอบเพิ่มเติม
- `innomcp-server-node/src/mcp/tools/thaiKnowledgeTool.ts`
  - ถ้า query alias ถูก route ไปยัง ThaiKnowledgeTool ก่อน geo
  - มี logic alias / fuzzy match ในฐานความรู้ด้วย

## 6. ข้อเสนอแนะแก้ไขด่วน

1. เพิ่ม alias entry สำหรับ:
   - `ปากช่อง` → `นครราชสีมา`
   - `หัวหิน` → `ประจวบคีรีขันธ์`
   - `แม่สาย` → `เชียงราย`
2. ตรวจสอบว่าฟังก์ชันค้นหา alias:
   - ตรงชื่อจังหวัดแบบ exact match
   - หา alias จาก `aliases` ที่มีค่า `includes(queryText)` ได้
3. เพิ่ม regression tests ใน `thaiGeoTool.spec.ts`
4. รันซ้ำ:
   - `cd innomcp-next && npx playwright test e2e/acceptance.spec.ts --project=chromium --reporter=list`

## 7. สถานะ commit
- สร้างรายงานใหม่ใน `docs/reports/alias_geo_lookup_test_summary.md`
- commit message: `docs: add alias geo lookup test summary and fix guidance`
