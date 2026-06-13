<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-014 role=trace model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":3129,"completion_tokens":2240,"total_tokens":5369,"prompt_tokens_details":{"cached_tokens":32,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1459,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 29s
 generated: 2026-06-13T12:01:14.036Z -->
Here is the concrete, ordered data flow trace for the `intentClassifier.ts` module, based on the provided code and inferred logic for the truncated portion.

### 1. Entry: Input Data
*   **Enters:** `message` (`string` - the raw user chat input) and `toolHint` (`string | undefined` - likely a routing hint from the caller).
*   **Source:** The Conductor service (or chat handler) invoking `classifyIntent`.

### 2. Step: Input Validation
*   **Transformation:** Checks if `message` is falsy or not a string.
*   **Logic:** `if (!message || typeof message !== "string")`
*   **Result:** If invalid, short-circuits and returns a default fallback object `{ intent: "general", expectedToolUsage: false, reasons: ["empty"] }`.

### 3. Step: Keyword Extraction & Matching (Parallel Evaluations)
*   **Transformation:** The `message` string is lowercased and scanned against an array of predefined Thai/English keyword dictionaries using `containsAny` and `evidenceMatch`.
*   **Sub-steps:**
    *   **Greeting/Factual/Planning/Weather/Datetime/Travel/Map/Calc/Code/Data/Research/Shell/Write:** Direct `containsAny` checks. Returns the matched keyword string or `null`.
    *   **Evidence:** Evaluated via `evidenceMatch()`. 
        *   *Special Logic:* If the matched word is "machine", "url", or "traffic", it checks for an "officer signal" (regex `OFFICER_SIGNAL_RE`). If no signal exists, it returns `null`.
        *   *Exclusion Logic:* Explicitly returns `null` for false positives like "machine learning" or "url encoding".
    *   **System Inventory (Inferred):** Calls the imported `looksLikeSystemInventoryQuestion(message)` (which was imported but truncated from the snippet).
*   **Result:** A set of local variables holding matched keywords (e.g., `const weather = "rain"`, `const evidence = null`).

### 4. Step: Intent Resolution & Prioritization (Inferred from truncation)
*   **Transformation:** An `if/else if` priority chain evaluates the matched keyword variables from Step 3. Because keywords can overlap (e.g., "trip" is in both `PLANNING_KEYWORDS` and `TRAVEL_KEYWORDS`), this step applies deterministic precedence (e.g., Evidence > Calc > Weather > Knowledge > General).
*   **Result:** Selection of exactly one primary `ChatIntent` string.

### 5. Step: Tool Usage & Reasoning Assignment (Inferred from truncation)
*   **Transformation:** Based on the resolved `ChatIntent`, sets the `expectedToolUsage` boolean to `true` if the intent typically requires tool invocation (e.g., Weather, Map, Calc, Shell, Evidence), or `false` if not (e.g., Greeting, Knowledge). Populates the `reasons` array with the specific keywords that triggered the intent.
*   **Result:** Finalizes the `ClassifyResult` object structure.

### 6. Exit: Output Data
*   **Exits:** `ClassifyResult` object: `{ intent: ChatIntent, expectedToolUsage: boolean, reasons: string[] }`
*   **Destination:** Returned to the Conductor service. The Conductor uses `intent` to route the workflow, and the naturalness guard uses `expectedToolUsage` to detect "Used tools: none" leaks.

---

### Side-Effects (DB / Network / Events / State)
*   **None.** As explicitly stated in the module docstring, this is a *"Pure-function, deterministic, keyword-based — no LLM call."* It performs no I/O, makes no database queries, triggers no network requests, and mutates no external state. It relies solely on in-memory string matching.
