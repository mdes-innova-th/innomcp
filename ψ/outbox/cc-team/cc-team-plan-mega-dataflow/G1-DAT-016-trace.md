<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-016 role=trace model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1409,"completion_tokens":1585,"total_tokens":2994,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":449,"image_tokens":0},"cache_creation_input_tokens":0} | 15s
 generated: 2026-06-13T12:01:41.752Z -->
## Trace Data Flow: `checkNaturalness` in `naturalnessGuard.ts` (Phase C Guard)

### Inputs
| Name | Type | Source |
|------|------|--------|
| `candidate` | `string` | Caller (e.g., Conductor after composition) |
| `opts` | `NaturalnessCheckOptions` | Caller (derived from conversation context) |
| `opts.intent` | `ChatIntent` (enum) | Intent classifier |
| `opts.expectedToolUsage` | `boolean` | Intent classifier / tool planner |
| `opts.userQuery` | `string` | Original user message (Thai query) |

---

### Step-by-Step Transformation & Checks

**Step 1 – Input validation**  
- Check: `!candidate || typeof candidate !== "string"`  
- If true → **return** `{ ok: false, ruleFired: "empty-answer", hint: "คำตอบว่าง..." }`  
- **Side‑effects**: None  

**Step 2 – Trim**  
- `const trimmed = candidate.trim()`  
- No mutation, new local string  

**Step 3 – Rule 1: Province request as whole answer for `planning-broad`**  
- Condition: `opts.intent === "planning-broad"` AND `PROVINCE_REQUEST_RE.test(trimmed)`  
- If true → **return** `{ ok: false, ruleFired: "planning-broad-province-only", hint: "อย่าตอบแค่..." }`  
- **Side‑effects**: None  

**Step 4 – Rule 2: Thai query but answer starts with English**  
- `const userIsThai = hasThaiCharacter(opts.userQuery)`  
- Condition: `userIsThai` AND `startsWithEnglish(trimmed)` AND `!hasThaiCharacter(trimmed.slice(0, 50))`  
- If true → **return** `{ ok: false, ruleFired: "english-first-leak", hint: "คำถามเป็นภาษาไทย..." }`  
- **Side‑effects**: None  

**Step 5 – Rule 3: Raw JSON at top level**  
- `RAW_JSON_RE.test(trimmed)`  
- If true → **return** `{ ok: false, ruleFired: "raw-json-leak", hint: "อย่าตอบเป็น JSON ดิบ..." }`  
- **Side‑effects**: None  

**Step 6 – Rules 4 & 5: Forbidden substrings via `checkVisibleTextSafe`**  
- **External call**: `checkVisibleTextSafe(trimmed, { allowMapTerms: opts.intent === "map", expectedToolUsage: opts.expectedToolUsage })`  
- This is a pure function from `../agents/eventGuard` (no I/O)  
- Returns `{ ok: boolean, forbiddenSubstring?: string }`  
- If `!guard.ok` → **return** `{ ok: false, ruleFired: guard.forbiddenSubstring ? "forbidden-substring:"+... : "guard-violation", hint: "พบข้อความที่ไม่เหมาะ..." }`  
- **Side‑effects**: None  

**Step 7 – Rule 6: `planning-broad` must include follow-up or plan frame**  
- Condition: `opts.intent === "planning-broad"`  
- Check: `!hasFollowup && !hasPlanFrame` (using regex on `trimmed`)  
- If true → **return** `{ ok: false, ruleFired: "planning-broad-too-shallow", hint: "คำตอบสำหรับคำถามวางแผน..." }`  
- **Side‑effects**: None  

**Step 8 – All checks passed**  
- **return** `{ ok: true }`  

---

### Outputs
| Name | Type | Destination |
|------|------|-------------|
| `NaturalnessResult` | `{ ok: boolean, ruleFired?: string, hint?: string }` | Caller (Stylist or Conductor) |

### Side‑Effects (at runtime)
- **None** – The function is pure, no database/network/event/state mutations.  
- The only imported helper (`checkVisibleTextSafe`) is also pure.  

### Flow Diagram (summary)
```
[candidate: string, opts: object] 
  │
  ├── Step1: validate candidate (non‑empty string) ──fail──→ return error
  │
  ├── Step2: trimmed = candidate.trim()
  │
  ├── Step3: Rule 1 (planning‑broad province‑only) ──fail──→ return error
  │
  ├── Step4: Rule 2 (Thai query / English first) ──fail──→ return error
  │
  ├── Step5: Rule 3 (raw JSON leak) ──fail──→ return error
  │
  ├── Step6: checkVisibleTextSafe() ──fail──→ return error
  │
  ├── Step7: Rule 6 (planning‑broad too shallow) ──fail──→ return error
  │
  └── Step8: return { ok: true }
```
