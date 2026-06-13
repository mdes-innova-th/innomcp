<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-024 role=trace model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":645,"completion_tokens":2337,"total_tokens":2982,"prompt_tokens_details":{"cached_tokens":32,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1342,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 14s
 generated: 2026-06-13T12:04:00.151Z -->
### Data Flow Trace: `innomcp-node/src/services/riskDetector.ts`

**Side-Effects:** None. This is a pure function. No DB calls, network requests, event emissions, or external state mutations.

---

#### 1. ENTER: Function Invocation
*   **Data:** `command` (Type: `string`, e.g., `"sudo rm -rf /"`) and `context` (Type: `string | undefined`, e.g., `"file-delete"`).
*   **Source:** External caller (likely an MCP tool handler or API route evaluating a user's command before execution).

#### 2. TRANSFORMATION: Critical Pattern Evaluation
*   **Action:** The `command` string is tested against the 5 regex patterns in the `CRITICAL_PATTERNS` array (e.g., `/rm\s+-rf?\s+[\/~]/i`, `/dd\s+if=/i`).
*   **Logic:** `CRITICAL_PATTERNS.some(p => p.test(command))`
*   **Branch:** If a match is found, flow jumps to **Exit A**. Otherwise, continues to Step 3.

#### 3. TRANSFORMATION: High Pattern Evaluation
*   **Action:** The `command` string is tested against the 7 regex patterns in the `HIGH_PATTERNS` array (e.g., `/sudo\s+/i`, `/chmod\s+777/i`).
*   **Logic:** `HIGH_PATTERNS.some(p => p.test(command))`
*   **Branch:** If a match is found, flow jumps to **Exit B**. Otherwise, continues to Step 4.

#### 4. TRANSFORMATION: Medium Pattern Evaluation
*   **Action:** The `command` string is tested against the 7 regex patterns in the `MEDIUM_PATTERNS` array (e.g., `/npm\s+install/i`, `/rm\s+\S+/i`).
*   **Logic:** `MEDIUM_PATTERNS.some(p => p.test(command))`
*   **Branch:** If a match is found, flow jumps to **Exit C**. Otherwise, continues to Step 5.

#### 5. TRANSFORMATION: Context String Evaluation
*   **Action:** Evaluates if the optional `context` parameter strictly equals `"file-delete"`.
*   **Logic:** `context === "file-delete"`
*   **Branch:** If true, flow jumps to **Exit D**. Otherwise, continues to Step 6.

#### 6. TRANSFORMATION: Default Low Risk Assignment
*   **Action:** If the command matched no patterns and the context is not "file-delete", the default state is generated.
*   **Branch:** Proceeds to **Exit E**.

---

#### EXITS (Shape: `RiskAssessment` object -> Destination: Caller)

*   **Exit A (from Step 2):** Returns `{ riskLevel: "critical", reason: "คำสั่งนี้อาจทำลายข้อมูลสำคัญหรือระบบไฟล์", requiresApproval: true }`
*   **Exit B (from Step 3):** Returns `{ riskLevel: "high", reason: "คำสั่งนี้มีความเสี่ยงสูง — อาจลบหรือแก้ไขข้อมูลสำคัญ", requiresApproval: true }`
*   **Exit C (from Step 4):** Returns `{ riskLevel: "medium", reason: "คำสั่งนี้แก้ไขไฟล์หรือ install package", requiresApproval: true }`
*   **Exit D (from Step 5):** Returns `{ riskLevel: "medium", reason: "การลบไฟล์ไม่สามารถย้อนกลับได้", requiresApproval: true }`
*   **Exit E (from Step 6):** Returns `{ riskLevel: "low", reason: "", requiresApproval: false }`
