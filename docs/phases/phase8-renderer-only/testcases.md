# Phase 8: LLM as Renderer Only - Test Cases

| ID  | User Query                                            | Expected Tool/Route | Expected Answer Structure / Constraints                                                                                   |
| :-- | :---------------------------------------------------- | :------------------ | :------------------------------------------------------------------------------------------------------------------------ |
| 1   | "กรุงเทพ หลักสี่ และลาดกระบังฝนตกไหม แบบละเอียด"      | WX Pipeline         | 2 districts listed. Bullet points for Rain %, Temp, Humidity. NO "โหมดทดสอบ".                                             |
| 2   | "บ้านใหม่ อยู่จังหวัดอะไร"                            | GEO Tool            | Identifies ambiguity (ERR:GEO_AMBIGUOUS) and asks for more context (e.g., district). NO hallucinated single province.     |
| 3   | "เมื่อวาน evidence ค้างเท่าไหร่ แยกตาม isp ใครมากสุด" | Evidence Tool       | Reports total count and top ISP. If missing DB creds, polite fallback is rendered. NO `ERR:MISSING_DETECT_DB_CREDS` text. |
| 4   | "Machine learning คืออะไร อธิบายสั้นๆ"                | GeneralGate         | 2-5 sentences. Explains ML concept. NO mention of internal ML tools or APIs.                                              |
| 5   | "Docker ใช้งานยังไง"                                  | GeneralGate         | Short guide/explanation. Cannot trigger Server Tool unless asking about _our_ infrastructure status.                      |
| 6   | "อากาศเชียงใหม่พรุ่งนี้"                              | WX Pipeline         | Future mode WX data. Province: เชียงใหม่.                                                                                 |
| 7   | "รหัสไปรษณีย์ 10250"                                  | GEO Tool            | Reports the district and province for 10250.                                                                              |
| 8   | "ตอนนี้เครื่อง Server ออนไลน์กี่เครื่อง"              | Evidence Tool       | Count of active machines.                                                                                                 |
| 9   | "สถานะระบบล่มไหม"                                     | Infra/Server Tool   | Checks specific local infra tool.                                                                                         |
| 10  | "พระราม 2 ฝนตกไหม"                                    | WX Pipeline         | Expected to map to a valid grid or report no exact match gracefully.                                                      |
| 11  | "สรุปยอด nip เมื่อวาน"                                | Evidence Tool       | Total count for yesterday from NIP table.                                                                                 |
| 12  | "ทำไมฟ้าถึงร้อง"                                      | GeneralGate         | Scientific explanation of thunder.                                                                                        |
| 13  | "พิกัด 13.75, 100.51"                                 | GEO Tool            | Resolves coordinate to district/province.                                                                                 |
| 14  | "100 usd เป็นเงินไทยเท่าไหร่"                         | Normal / MCP        | Requires real-time conversion or polite fallback if tool unavailable. NO hallucinated rates.                              |
| 15  | "KPI ย่อมาจากอะไร"                                    | GeneralGate         | Exact definition of KPI.                                                                                                  |
| 16  | "ยอดการจับกุมเมื่อวาน"                                | Evidence Tool       | Maps to yesterday total intent.                                                                                           |
| 17  | "ช่วยเปรียบเทียบ React กับ Vue"                       | GeneralGate         | Concise technical comparison.                                                                                             |
| 18  | "วันนี้เก็บหลักฐานได้กี่รายการ"                       | Evidence Tool       | Today's record count.                                                                                                     |
| 19  | "สภาพอากาศภูเก็ต 3 วันล่วงหน้า"                       | WX Pipeline         | Forecast tool for Phuket.                                                                                                 |
| 20  | "ถนนสุขุมวิท"                                         | GEO Tool            | Ambiguous without district/province. Prompts user.                                                                        |
| 21  | "ใครเป็นนายก"                                         | GeneralGate         | Polite statement of current knowledge or asking for specific year.                                                        |
| 22  | "เช็คสถานะ Database Detect"                           | Infra/Evidence Tool | Ping DB connection status.                                                                                                |
| 23  | "อุณหภูมิขอนแก่นตอนนี้"                               | WX Pipeline         | Current station data for Khon Kaen.                                                                                       |
| 24  | "อำเภอเมือง"                                          | GEO Tool            | Highly ambiguous. Demands province. (ERR:GEO_AMBIGUOUS).                                                                  |
| 25  | "อธิบาย RAG"                                          | GeneralGate         | RAG definition. Matches SMOKE_MODE test case.                                                                             |
