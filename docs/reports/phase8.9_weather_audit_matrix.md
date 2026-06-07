# Phase 8.9 Weather UX Audit Matrix

_Generated via SMOKE_MODE analysis for deterministic behavior tracking._

| Case ID                          | Input (District/Province)     | Expected Route/Intent               | Expected Shape (Output)                         | Observed (Simulated/Baseline) | PASS/FAIL | Root Cause (if FAIL) |
| :------------------------------- | :---------------------------- | :---------------------------------- | :---------------------------------------------- | :---------------------------- | :-------- | :------------------- |
| **BKK Multi-District**           |
| WX-B-01                          | กรุงเทพ เขตหลักสี่            | WX_SPECIFIC (Bangkok, Laksi)        | Station data for Laksi / multi-target structure | TBD                           | TBD       |                      |
| WX-B-02                          | กทม ลาดกระบัง                 | WX_SPECIFIC (Bangkok, Lat Krabang)  | Station data for Lat Krabang                    | TBD                           | TBD       |                      |
| WX-B-03                          | กรุงเทพ หลักสี่ และ ลาดกระบัง | WX_SPECIFIC (Bangkok) x2            | Aggregated multi-district                       | TBD                           | TBD       |                      |
| WX-B-04                          | เขตพญาไท                      | WX_SPECIFIC (Bangkok, Phaya Thai)   | Station data for Phaya Thai (implied BKK)       | TBD                           | TBD       |                      |
| WX-B-05                          | BKK บางเขน                    | WX_SPECIFIC (Bangkok, Bang Khen)    | Station data for Bang Khen                      | TBD                           | TBD       |                      |
| **Province Today / 7 Days**      |
| WX-P-01                          | เชียงใหม่ วันนี้              | WX_SPECIFIC (Chiang Mai, Today)     | Today’s specific WX data                        | TBD                           | TBD       |                      |
| WX-P-02                          | ภูเก็ต 7 วัน                  | WX_SPECIFIC (Phuket, 7 Days)        | 7-day forecast array                            | TBD                           | TBD       |                      |
| WX-P-03                          | อากาศขอนแก่นพรุ่งนี้          | WX_SPECIFIC (Khon Kaen, Tomorrow)   | Tomorrow’s WX data                              | TBD                           | TBD       |                      |
| WX-P-04                          | โคราช ช่วงนี้                 | WX_SPECIFIC (Nakhon Ratchasima, 7D) | 7-day forecast array                            | TBD                           | TBD       |                      |
| WX-P-05                          | กทม 3 ชั่วโมง                 | WX_SPECIFIC (Bangkok, 3H)           | NWP/Station 3H forecast                         | TBD                           | TBD       |                      |
| **Province Missing / Not Found** |
| WX-M-01                          | เมืองทิพย์                    | WX_NATIONAL/PROVINCE_MISSING        | ERR:WX_PROVINCE_MISSING or Fallback             | TBD                           | TBD       |                      |
| WX-M-02                          | อากาสเป็นไงบ้าง               | WX_NATIONAL                         | National forecast summary                       | TBD                           | TBD       |                      |
| WX-E-01                          | ตกไหมที่จังหวัดไม่มีจริง      | WX_NATIONAL/PROVINCE_MISSING        | ERR:WX_PROVINCE_MISSING                         | TBD                           | TBD       |                      |
| **Station Not Found Fallback**   |
| WX-S-01                          | อำเภอเล็กๆในเชียงใหม่         | WX_SPECIFIC (Chiang Mai)            | Fallback to Provincial centroid or NWP          | TBD                           | TBD       |                      |
| WX-S-02                          | เกาะไกลๆภูเก็ต                | WX_SPECIFIC (Phuket)                | Fallback to Provincial centroid or NWP          | TBD                           | TBD       |                      |

**Goals:**

- Eliminate ambiguity in Bangkok district WX queries.
- Ensure graceful fallbacks when stations or provinces are missing.
- Achieve 100% PASS during the implementation phase.
