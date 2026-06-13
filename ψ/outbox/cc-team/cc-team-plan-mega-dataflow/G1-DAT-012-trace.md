<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-012 role=trace model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":2436,"completion_tokens":3628,"total_tokens":6064,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2652,"image_tokens":0},"cache_creation_input_tokens":0} | 69s
 generated: 2026-06-13T12:01:40.835Z -->
### Module Trace: `generalGate.ts`

**1. Module Initialization & Constants**
*   **Enters:** N/A (Module load time).
*   **Transformation:** Binds `LOW_CONFIDENCE_FALLBACK_TEXT` to a static Thai fallback string.
*   **Exits:** Exports 1 constant and 4 pure functions.
*   **Side-effects:** None.

**2. Execution: `renderGeneralFallbackMessage()`**
*   **Enters:** None.
*   **Transformation:** Returns a hardcoded Thai string explaining system latency and prompting the user for more specific context.
*   **Exits:** `string` (Destination: UI/Chat fallback message).
*   **Side-effects:** None.

**3. Execution: `renderThaiNumberText(value: number)`**
*   **Enters:** `value` (`number`, Source: Calculator tools or data formatting pipelines).
*   **Transformation Steps:** 
    1. **Validation:** Checks for `!Number.isFinite`, handles `0`, and recursively prefixes "ลบ" for negative numbers.
    2. **Chunking:** Splits number into `millions` and `remainder` (modulo 1,000,000).
    3. **Digit Mapping (`renderChunk`):** Maps individual digits to Thai words using positional arrays (`units`, `positions`). Applies Thai linguistic rules (e.g., "เอ็ด" for 1 in units place, "ยี่สิบ" for 20, "สิบ" for 10).
*   **Exits:** `string` (Thai text representation, e.g., "หนึ่งล้านสองแสน").
*   **Side-effects:** None.

**4. Execution: `countDaysUntilEndOfYear(baseDate: Date)`**
*   **Enters:** `baseDate` (`Date`, Source: System clock or injected date).
*   **Transformation Steps:** 
    1. **Normalization:** Strips time from `baseDate` to midnight (00:00:00).
    2. **Targeting:** Constructs `end` date as Dec 31 of the exact same year.
    3. **Calculation:** Computes delta in milliseconds, divides by 86400000 (ms in a day), rounds, and applies `Math.max(0, ...)` to prevent negative days.
*   **Exits:** `number` (Integer days remaining).
*   **Side-effects:** None.

**5. Execution: `renderGeneralSmokeAnswer(userText: string)` (Primary Router)**
*   **Enters:** `userText` (`string`, Source: `routes/api/chat.ts` / LLM Router intercept).
*   **Transformation Steps:**
    1. **Sanitization:** `t = String(userText || "").trim()`.
    2. **Status/Ping Check:** Regex tests for "พร้อมใช้งาน", "ping", "alive". If match → returns status string.
    3. **Identity Check:** Regex tests for "ชื่ออะไร", "who are you". If match → returns "Innova-bot" identity string.
    4. **Capability Check:** Regex tests for "ทำอะไรได้", "help". If match → returns feature list string.
    5. **Language Guard:** Regex tests for Thai characters (`/[ก-ฮ]/`). If *no* Thai chars found → immediately returns `LOW_CONFIDENCE_FALLBACK_TEXT`.
    6. **Geography Routing:** Regex tests for Thai regions (ภาคกลาง, เหนือ, อีสาน, ใต้, ตะวันออก) combined with "จังหวัด". If match → returns hardcoded province lists.
    7. **Domain Knowledge Routing:** Regex tests for specific tech/data topics (NASA, WorldBank, RAG, AI, KPI, Docker, ML, Solar). If match → returns canned definitions.
    8. **Date Math Routing:** Regex tests for "สิ้นปีนี้เหลือ" (days until end of year). If match → invokes `countDaysUntilEndOfYear(new Date())` and interpolates the result into a Thai string.
*   **Exits:** `string` (Destination: Direct API response to user, bypassing LLM inference).
*   **Side-effects:** 
    *   **DB/Network/Events/State:** None. (Strictly pure/stateless module).
    *   **System:** Reads system clock (`new Date()`) *only* if the Date Math regex branch (Step 5.8) is triggered.
