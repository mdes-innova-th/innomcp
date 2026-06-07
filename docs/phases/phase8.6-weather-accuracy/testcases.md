# Phase 8.6: Weather Accuracy Test Cases

**Execution:** `cd innomcp-node; npx ts-node scripts/verify_phase86_accuracy.ts`

| ID    | Category    | Input / Test Query                  | Expected Fallback / Output Pattern            |
| ----- | ----------- | ----------------------------------- | --------------------------------------------- |
| TC-01 | WX_TIMEOUT  | _Trigger network delay > BUDGET_MS_ | `(ERR:WX_TIMEOUT)`                            |
| TC-02 | WX_UPSTREAM | _Trigger HTTP 500 from TMD API_     | `(ERR:WX_UPSTREAM)`                           |
| TC-03 | WX_NO_DATA  | "สภาพอากาศเมืองทิพย์"               | `(ERR:WX_NO_DATA)`                            |
| TC-04 | WX_NO_DATA  | "ฝนตกไหมที่ดาวอังคาร"               | `(ERR:WX_NO_DATA)`                            |
| TC-05 | NORMAL      | "กรุงเทพ วันนี้ฝนตกไหม"             | `พื้นที่: กรุงเทพมหานคร\nโอกาสฝน:`            |
| TC-06 | MULTI-BKK   | "อากาศเขตบางเขนและปทุมวัน"          | `พื้นที่: บางเขน` ... `พื้นที่: ปทุมวัน`      |
| TC-07 | NORMAL      | "เชียงใหม่ พรุ่งนี้"                | `ช่วงเวลา: พรุ่งนี้` ... `พื้นที่: เชียงใหม่` |
| TC-08 | TIMING      | "ฝนตกไหม วันนี้"                    | `ช่วงเวลาเสี่ยง: เช้า: สังเกตการณ์ล่าสุด`     |
| TC-09 | ADVICE      | _Mock Rain > 60%_                   | `ข้อควรระวัง: ระวังฝนและถนนลื่น`              |
| TC-10 | ADVICE      | _Mock Rain < 10%_                   | `ข้อควรระวัง: ไม่มีคำเตือนพิเศษ`              |
| TC-11 | HYGIENE     | _Any failure_                       | Must **not** contain `{`, `}`, `process.env`  |
| TC-12 | HYGIENE     | _Any fallback_                      | Must **not** contain "โหมดทดสอบ"              |
| TC-13 | EFFICIENCY  | _TMD forecast missing province_     | `ERR:WX_NO_DATA` (Halt, no NWP fallback)      |
| TC-14 | EFFICIENCY  | _Station error during multi-prov_   | Only disables station for that target         |
