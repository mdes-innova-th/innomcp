# Phase 8.9 Test Cases (Verifier target)

## Suite A: Bangkok District Edge Cases

1. `กรุงเทพ หลักสี่`
2. `กทม ลาดกระบัง`
3. `พญาไท กรุงเทพ`
4. `เขตบางเขน` (Implied BKK)
5. `สภาพอากาศ หลักสี่ และ ลาดกระบัง` (Multi-target)

## Suite B: Provincial Fallback and Routing

6. `เชียงใหม่ วันนี้`
7. `ภูเก็ต 7 วัน`
8. `ขอนแก่น พรุ่งนี้`
9. `อำเภอที่ไม่ค่อยดังในเชียงใหม่` (Station Fallback test)

## Suite C: Error & Guard Tests

10. `สภาพอากาศเมืองทิพย์` -> `ERR:WX_PROVINCE_MISSING`
11. Simulated TMD 3H failure on `เชียงใหม่` -> Confirm NWP fallback triggers.
12. Simulated `PROVINCE_NOT_FOUND_IN_FORECAST` -> Confirm NWP fallback is SKIPPED and `ERR:WX_NO_DATA` is emitted.

_(These represent the 12 core automated paths mapped against the 15-case Audit Matrix)._
