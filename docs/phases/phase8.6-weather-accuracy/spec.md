# Phase 8.6: Weather Accuracy (Renderer-Only)

## 1. Goal

Harden the weather pipeline accuracy and deterministic error rendering ensuring no LLM hallucinations are introduced during failures.

## 2. Invariants (Renderer-Only)

- The LLM **MUST NOT** hallucinate weather numbers (e.g., 30°C, 70% rain) under any circumstances.
- The LLM **MUST NOT** attempt to guess missing provinces or map them incorrectly.
- All upstream failures, timeouts, and missing data must be mapped to a strict Error Taxonomy and rendered defensively in Thai.

## 3. Data Sources & Routing

- **Primary:** 3-Hour Station Data (`station3h`).
- **Fallback 1:** 7-Day Province Forecast (`forecast7d`).
- **Fallback 2:** NWP Engine (if supported in future iterations).
- **Bangkok 2-District Query:** Handled strictly by the pipeline. If a query contains multiple districts within Bangkok (e.g., "บางเขนและลาดกระบัง"), the backend fetches both and maps them into a robust structural output.

## 4. Failure Taxonomy & Fallback Policy

All pipeline failures (`r.type === "error"`) must be classified into one of three categories before rendering to the user:

1. **`ERR:WX_TIMEOUT`**
   - _Causes:_ `TIMEOUT`, `BUDGET_EXCEEDED`
   - _Wording:_ "ขออภัย ระบบดึงข้อมูลอากาศไม่ทันเวลา กรุณาลองใหม่อีกครั้ง (ERR:WX_TIMEOUT)"
2. **`ERR:WX_UPSTREAM`**
   - _Causes:_ `API_ERROR`, `CLIENT_NOT_FOUND`, `UNEXPECTED_ERROR`
   - _Wording:_ "ขออภัย ระบบดึงข้อมูลอากาศขัดข้อง กรุณาลองใหม่อีกครั้ง (ERR:WX_UPSTREAM)"
3. **`ERR:WX_NO_DATA`**
   - _Causes:_ `STATION_NOT_FOUND`, `PROVINCE_NOT_FOUND_IN_FORECAST`, `DATA_UNAVAILABLE`, `NATIONAL_DATA_UNAVAILABLE`
   - _Wording:_ "ขออภัย ยังไม่มีข้อมูลอากาศสำหรับพื้นที่นี้ในขณะนี้ (ERR:WX_NO_DATA)"
   - _Rule:_ `PROVINCE_NOT_FOUND_IN_FORECAST` must halt immediately. **No NWP fallback** is attempted to prevent wasted upstream calls.

## 5. Security & Hygiene

- No leaking of `process.env.*` into internal error traces or JSON.
- No test-mode or fixture strings ("โหมดทดสอบ", "เพื่อการทดสอบระบบ") allowed in production branches.
- Upstream network errors must be caught and normalized into the taxonomy above.
