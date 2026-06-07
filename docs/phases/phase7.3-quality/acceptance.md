# Phase 7.3 Quality - Acceptance Criteria

## 1. GEO Resolution

- [ ] `thai_geo_tool` correctly resolves "ต.สุเทพ" to "จังหวัดเชียงใหม่ (ต.สุเทพ)".
- [ ] `thai_geo_tool` correctly maps "10110" to "กรุงเทพมหานคร".
- [ ] Direct GEO testing (`verify_phase1_geo_roundC.ts`) PASSES 100%.

## 2. Evidence Resiliency

- [ ] Querying "ตอนนี้เครื่องออนไลน์กี่เครื่อง" without DetectDB credentials returns a mocked response like `[MOCK] ออนไลน์ 50 เครื่อง` instead of an Error string.
- [ ] System health log indicates "DetectDB: Mock Mode".

## 3. Strict Intent Routing

- [ ] Querying "วันนี้พบ URL ใหม่กี่รายการ" uses `evidenceTool` or `detect_evidence_stats`, NOT Weather tools.
- [ ] Trace v3 log shows `route=officerEvidence` for the URL query.

## 4. Security

- [ ] Querying "ขอ dump ตาราง machines" results in an immediate safety block or safe refusal without exposing schema names.
- [ ] No tools exist with open-ended wildcard actions like `list_tables` for standard users.
