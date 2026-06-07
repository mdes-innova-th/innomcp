# Phase 8.3: Polished Test Cases (≥40 UI-Real Cases)

## GEO (Geography & Normalization)

| ID  | Query                           | Expected Contract/Shape                 |
| --- | ------------------------------- | --------------------------------------- |
| G01 | "หลักสี่"                       | Resolves to `เขตหลักสี่ กรุงเทพมหานคร`  |
| G02 | "บางรัก และลาดกระบัง"           | `GEO_AMBIGUOUS` or requires splitting   |
| G03 | "ชลบุรี พัทยา"                  | Resolves correct admin districts        |
| G04 | "อำเภอเมือง"                    | `ERR:GEO_AMBIGUOUS` + asks for province |
| G05 | "บ้านใหม่"                      | `ERR:GEO_AMBIGUOUS` + Top 3 list        |
| G06 | "รหัสไปรษณีย์ 10250"            | `เขตสวนหลวง`                            |
| G07 | "พิกัด 13.75, 100.51"           | Resolves location                       |
| G08 | "เชียงใหม่ ถนนนิมมาน"           | Resolves `อำเภอเมืองเชียงใหม่`          |
| G09 | "กทม สุขุมวิท"                  | `ERR:GEO_AMBIGUOUS`                     |
| G10 | "ตรวจสอบที่อยู่ สตึก บุรีรัมย์" | Resolves perfectly                      |

## WX (Weather Forecast & Current)

| ID  | Query                     | Expected Contract/Shape                       |
| --- | ------------------------- | --------------------------------------------- |
| W01 | "อากาศลักสี่และลาดกระบัง" | **TWO-TARGET Shape**                          |
| W02 | "พัทยาฝนตกไหม"            | Single target weather summary                 |
| W03 | "กทม บางรัก และปทุมวัน"   | **TWO-TARGET Shape**                          |
| W04 | "อากาศเชียงใหม่พรุ่งนี้"  | WX forecast table                             |
| W05 | "อุณหภูมิขอนแก่นตอนนี้"   | Current WX reading                            |
| W06 | "ฝนตกไหม"                 | `ERR:WX_PROVINCE_MISSING` (Asks for location) |
| W07 | "พะเยาหนาวไหม"            | Temp report for Phayao                        |
| W08 | "สภาพอากาศภูเก็ต 3 วัน"   | 3-day forecast formatting                     |
| W09 | "กทม จตุจักร และบางซื่อ"  | **TWO-TARGET Shape**                          |
| W10 | "อากาศอำเภอเมือง"         | `ERR:GEO_AMBIGUOUS` bounds check              |

## EVI (Evidence & Machine Dashboards)

| ID  | Query                            | Expected Contract/Shape                 |
| --- | -------------------------------- | --------------------------------------- |
| E01 | "เมื่อวาน ISP ไหนมากสุด"         | **YESTERDAY + ISP Shape**               |
| E02 | "ยอด NIP เมื่อวานเท่าไหร่"       | `- รวม:`                                |
| E03 | "วันนี้เครื่องออฟไลน์กี่เครื่อง" | `ตอนนี้เครื่องออฟไลน์: [X] เครื่อง`     |
| E04 | "เซิร์ฟออนไลน์ทั้งหมด"           | `ตอนนี้เครื่องออนไลน์: [X] เครื่อง`     |
| E05 | "หลักฐานจาก True เมื่อวาน"       | Filtered EVI block for True             |
| E06 | "เมื่อวานนี้ยอดเท่าไหร่"         | `evidence_records_yesterday_total`      |
| E07 | "ขอ top ISP เมื่อวาน"            | **YESTERDAY + ISP Shape**               |
| E08 | "nip วันนี้กี่อัน"               | `evidence_records_today`                |
| E09 | "URL detected สัปดาห์นี้"        | `ERR:EVI_SCHEMA_MISMATCH` or real count |
| E10 | "ยอด nip แยกตามค่ายเมื่อวาน"     | **YESTERDAY + ISP Shape**               |

## General (Interception & Fast Fallback)

| ID  | Query                        | Expected Contract/Shape             |
| --- | ---------------------------- | ----------------------------------- |
| M01 | "อธิบาย Machine Learning"    | 2-5 sentence polish                 |
| M02 | "ทำไมฟ้าถึงร้อง"             | Science explanation, polite         |
| M03 | "สอนเขียน React เบื้องต้น"   | General overview                    |
| M04 | "Docker ทำงานยังไง"          | Tech summary (no infra tool usage)  |
| M05 | "100 usd เงินไทย"            | Currency conversion / polite reject |
| M06 | "ใครเป็นนายก"                | General fact                        |
| M07 | "KPI คืออะไร"                | Definition polish                   |
| M08 | "เปรียบเทียบ Vue กับ Svelte" | General comparison                  |
| M09 | "1234567"                    | Polite confusion                    |
| M10 | "..."                        | Polite confusion / prompt for info  |
