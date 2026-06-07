# Phase 8.2: Robustness Test Cases (≥35 Cases)

## WX/GEO Typo & Alias

| ID  | User Query                      | Expected Resolution / Output Marker                             |
| :-- | :------------------------------ | :-------------------------------------------------------------- |
| 1   | "อากาศลักสี่"                   | Resolves to "หลักสี่"                                           |
| 2   | "ฝนตกไหมพัทยา"                  | Resolves to ชลบุรี (พัทยา)                                      |
| 3   | "กทม บางรัก และปทุมวัน ฝนตกไหม" | `(บางรัก + ปทุมวัน)`                                            |
| 4   | "ขอนแก่นร้อนไหม"                | WX Station data for Khon Kaen                                   |
| 5   | "โคราชอากาศ"                    | Resolves to นครราชสีมา                                          |
| 6   | "กทมร้อนไหม"                    | Resolves to กรุงเทพมหานคร                                       |
| 7   | "อำเภอเมือง"                    | `GEO_AMBIGUOUS` - "กรุณาระบุจังหวัดเพิ่มเติม"                   |
| 8   | "บ้านใหม่ อยู่จังหวักไร"        | `GEO_AMBIGUOUS` OR typo handling for "จังหวักไร" -> จังหวัดอะไร |
| 9   | "ฝนตอกไหม"                      | Typo handling maps to WX                                        |
| 10  | "อสนกระบี่"                     | Fallback / Reject clean (unintelligible)                        |
| 11  | "สถาพอากาศ"                     | Typo handling maps to WX                                        |

## EVI Colloquial Intents

| ID  | User Query                      | Expected Resolution / Output Marker                 |
| :-- | :------------------------------ | :-------------------------------------------------- |
| 12  | "วันนี้ record เท่าไหร่"        | `evidence_records_today`                            |
| 13  | "จับได้กี่อันวันนี้"            | `evidence_records_today`                            |
| 14  | "เมื่อวาน nip"                  | `evidence_records_yesterday_total`                  |
| 15  | "ค่ายไหนเยอะสุดเมื่อวาน"        | `evidence_records_yesterday_by_isp_top`             |
| 16  | "เซิร์ฟเวอออนไลกี่ตัว"          | `active_machines_count`                             |
| 17  | "เครื่องออฟไลนมีไหม"            | `active_machines_offline_count`                     |
| 18  | "เมื่อวานนี้ยอด"                | `evidence_records_yesterday_total`                  |
| 19  | "evidence จาก True"             | `evidence_records_by_isp` (True)                    |
| 20  | "ยอดตรวจพบ URL สัปดาห์นี้"      | `detected_urls_weekly` (if implemented) or fallback |
| 21  | "วันนี้ URL detected กี่รายการ" | `detected_urls_today`                               |

## General & Fallbacks

| ID  | User Query                      | Expected Resolution / Output Marker    |
| :-- | :------------------------------ | :------------------------------------- |
| 22  | "ช่วยเปรียบเทัยบ React กับ Vue" | GeneralGate (เปรียบเทียบ)              |
| 23  | "สอนเขัยน Python"               | GeneralGate (สอนเขียน)                 |
| 24  | "ใครคือนายกกรัฐมนตรั"           | GeneralGate                            |
| 25  | "ทำไมฟ้าถึงล้อง"                | GeneralGate (ฟ้าถึงร้อง)               |
| 26  | "RAG คืออะไน"                   | GeneralGate (คืออะไร)                  |
| 27  | "100 usd เป็นเงินไทยกี่บาท"     | Normal conversion tool / polite reject |
| 28  | "ตอนนี้กล่อง CCTV พังไหม"       | Infra ops -> check status              |
| 29  | "Docker ทำง่นยังไง"             | GeneralGate                            |
| 30  | "อุณภูมิเชียงใหม่"              | WX (อุณหภูมิ)                          |
| 31  | "รหัสไปษณี 10250"               | GEO (รหัสไปรษณีย์)                     |

## Edge Cases

| ID  | User Query                       | Expected Resolution / Output Marker             |
| :-- | :------------------------------- | :---------------------------------------------- |
| 32  | "..."                            | GeneralGate (Short circuit polite)              |
| 33  | "12345678"                       | GeneralGate / Unknown                           |
| 34  | "กรุงเทพ" (No other context)     | GEO / General ask for intent                    |
| 35  | "บางรัก ปทุมวัน จตุจักร ฝนตกไหม" | WX (Should slice to top 2 or handle gracefully) |
