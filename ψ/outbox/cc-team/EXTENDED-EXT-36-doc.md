<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-36 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":58,"completion_tokens":973,"total_tokens":1031,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":373,"image_tokens":0},"cache_creation_input_tokens":0} | 11s
 generated: 2026-06-13T05:26:47.536Z -->
```markdown
# InnOMCP Testing Guide / คู่มือการทดสอบ InnOMCP

## Unit Tests / การทดสอบหน่วย

Tests individual functions and components in isolation.

**Command / คำสั่ง:**
```bash
npm run test:unit
```

**Expected output when all pass / ผลลัพธ์ที่คาดหวังเมื่อผ่���นทั้งหมด:**
```
 PASS  tests/unit/example.test.ts
  ✓ should do something (2 ms)

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
```

## Integration Tests / การทดสอบบูรณาการ

Verifies interactions between modules, database, or external services.

**Command / คำสั่ง:**
```bash
npm run test:integration
```

**Expected output / ผลลัพธ์ที่คาดหวัง:**
```
 PASS  tests/integration/api.test.ts
  ✓ should create resource (12 ms)

Test Suites: 2 passed, 2 total
Tests:       8 passed, 8 total
Snapshots:   0 total
Time:        0.5 s
```

## E2E Tests (Playwright) / การทดสอบจากต้นทางถึงปลายทาง (Playwright)

Runs full browser-based tests simulating user interactions.

**Command / คำสั่ง:**
```bash
npx playwright test
```

**Expected output / ผลลัพธ์ที่คาดหวัง:**
```
Running 3 tests using 1 worker
  ✓ should login and navigate (2.1s)
  ✓ should create new item (1.8s)
  ✓ should delete item (1.2s)
  3 passed (5.2s)
```

## Smoke Tests / การทดสอบควัน

Quick sanity checks after deployment to verify critical paths.

**Command / คำสั่ง:**
```bash
npm run test:smoke
```

**Expected output / ผลลัพธ์ที่คาดหวัง:**
```
Smoke tests passed: 4/4
- Health endpoint: OK
- Database connection: OK
- Authentication: OK
- Core API: OK
```

## Running All Tests / การรันการทดสอบทั้งหมด

```bash
npm test
```

**Expected output / ผลลัพธ์ที่คาดหวัง:**
```
 PASS  tests/unit/...
 PASS  tests/integration/...
 PASS  tests/e2e/...
 PASS  tests/smoke/...

All tests passed! 🎉
```

> **Note:** Ensure all dependencies are installed (`npm install`) and environment variables (e.g., `.env.test`) are configured before running tests.  
> **หมายเหตุ:** ตรวจสอบให้แน่ใจว่าติดตั้ง dependencies แล้ว (`npm install`) และตั้งค่าตัวแปรสภาพแวดล้อม (เช่น `.env.test`) ก่อนรันการทดสอบ
```
