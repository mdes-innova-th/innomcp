# Phase 7.4: General Intelligence Hardening - Test Cases

| ID  | User Query                                    | Expected Route        | Tools Allowed | Expected Output Style / Constraints                                                                              |
| :-- | :-------------------------------------------- | :-------------------- | :------------ | :--------------------------------------------------------------------------------------------------------------- |
| 1   | "สวัสดีครับ"                                  | general / fastpath    | No            | Short greeting.                                                                                                  |
| 2   | "AI คืออะไร อธิบายสั้นๆ"                      | general               | No            | 2-5 sentence explanation of AI. No mention of tools.                                                             |
| 3   | "RAG แตกต่างจาก Fine-tuning อย่างไร"          | general               | No            | Concise comparison.                                                                                              |
| 4   | "ช่วยแนะนำวิธีปลูกต้นไม้ในคอนโดหน่อย"         | general               | No            | Bullet points or short guide.                                                                                    |
| 5   | "ทำไมท้องฟ้าถึงเป็นสีฟ้า?"                    | general               | No            | Scientific explanation in simple Thai.                                                                           |
| 6   | "วันนี้ฝนตกไหม ที่ลาดกระบัง"                  | weatherGate / mcp     | Yes           | MUST NOT route to general. Must fetch real weather.                                                              |
| 7   | "สรุปยอดหลักฐานเมื่อวานแยกตาม ISP"            | officerEvidence / mcp | Yes           | MUST NOT route to general. Must query Detect DB.                                                                 |
| 8   | "พิกัดละติจูด 13.7 ลองจิจูด 100.5 อยู่เขตไหน" | geo / mcp             | Yes           | MUST NOT route to general. Must resolve GEO.                                                                     |
| 9   | "15 + 24 เท่ากับเท่าไหร่"                     | math / normal         | Yes/No        | MUST NOT route to general. Route to calc tool or normal.                                                         |
| 10  | "ตอนนี้เวลา 15:00 หรือยัง"                    | normal                | Yes/No        | MUST NOT route to general. DateTime intent.                                                                      |
| 11  | "เครื่อง server สถานะเป็นไงบ้าง"              | officerEvidence / mcp | Yes           | MUST NOT route to general. Evidence intent.                                                                      |
| 12  | "สรุปข่าววันนี้ให้ฟังหน่อย"                   | general               | No            | Should explain it doesn't have real-time news unless provided context, or ask for context. No hallucinated news. |
| 13  | "OKRs ดีกว่า KPIs อย่างไร"                    | general               | No            | Clear comparison.                                                                                                |
| 14  | "รหัสไปรษณีย์ 10500"                          | geo / mcp             | Yes           | MUST NOT route to general. GEO intent.                                                                           |
| 15  | "ช่วยแต่งกลอนแปดหัวข้อความเชื่อใจ"            | general               | No            | Poem generation.                                                                                                 |
| 16  | "ทำไมถึงเกิดเหตุการณ์น้ำท่วมบ่อยในช่วงนี้"    | general               | No            | General knowledge explanation.                                                                                   |
| 17  | "กทม ฝนตกไหม"                                 | weatherGate / mcp     | Yes           | Weather intent.                                                                                                  |
| 18  | "เมื่อไหร่จะเลิกงาน"                          | general               | No            | Must answer conversationally, ask back.                                                                          |
| 19  | "http://example.com เว็บนี้คืออะไร"           | normal / mcp          | Yes           | URL parsing/fetching intent. MUST NOT route to general.                                                          |
| 20  | "ขอตัวอย่างโค้ด Python ตะลุย Leetcode หน่อย"  | general               | No            | Short code snippet + explanation.                                                                                |
| 21  | "ต้มยำกุ้งใส่อะไรบ้าง"                        | general               | No            | Recipe list.                                                                                                     |
| 22  | "จังหวัดเชียงใหม่ มีอำเภออะไรบ้าง"            | geo / mcp             | Yes           | GEO intent. MUST NOT route to general.                                                                           |
| 23  | "PHASE74_FORCE_TIMEOUT" (SMOKE_MODE=1)        | general               | No            | MUST return the exact Thai fallback string.                                                                      |
| 24  | "RAG" (SMOKE_MODE=1)                          | general               | No            | MUST return deterministic RAG definition.                                                                        |
| 25  | "หลักฐานค้างดำเนินการวันนี้"                  | officerEvidence / mcp | Yes           | Evidence intent.                                                                                                 |

**Forbidden Strings (Across all General queries):**

- "ผมใช้ tool"
- "ข้อมูลจากฐานข้อมูล"
- "ERR:TIMEOUT"
- "ขออภัย ระบบขัดข้อง" (unless it's the specific fallback copy)
