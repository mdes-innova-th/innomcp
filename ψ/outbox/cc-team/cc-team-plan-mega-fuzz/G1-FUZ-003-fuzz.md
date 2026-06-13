<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-003 role=fuzz model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1691,"completion_tokens":5000,"total_tokens":6691,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 44s
 generated: 2026-06-13T11:58:40.266Z -->
The user wants property-based / fuzz test cases for the provided TypeScript module (`agents/events.ts`). I need to:

1. Enumerate input invariants and properties that must always hold.
2. Identify adversarial/malformed/boundary inputs that could break them.
3. Output a markdown list in the format: property → fuzz input → expected invariant.
4. Keep it concrete, no filler.

The module contains:
- Types: `AgentEventType`, `AgentId`, `AgentEvent`
- Constants: `AGENT_ROLE_LABEL_TH`, `SCHEMA_VERSION`, `PUBLIC_SUMMARY_MAX`
- Functions: `validateAgentEvent(ev: unknown)`, `newEnvelope(opts)`

Key areas to test:
1. `validateAgentEvent` function - this is the main validation logic.
2. `newEnvelope` function - envelope construction.
3. Type constraints (AgentEventType, AgentId).
4. Boundary conditions (PUBLIC_SUMMARY_MAX, confidence 0..1, required fields).
5. Type-specific required fields (draft_delta needs deltaText, final_answer needs finalText, etc.).
6. `isSafeForUser` must be literal `true`.
7. `AGENT_ROLE_LABEL_TH` mapping completeness.

Let me think about invariants and fuzz inputs:

**Invariants for validateAgentEvent:**
- Must reject non-objects (null, undefined, primitives, arrays).
- Must reject missing/empty required string fields: type, runId, messageId, publicSummary, timestamp.
- Must reject unknown event types.
- Must reject `isSafeForUser` !== true (including `false`, `"true"`, `1`, etc.).
- Must reject `publicSummary` > 240 chars.
- Must reject `confidence` outside [0,1] or non-number.
- Must reject `sourceIds` if not string array (including mixed arrays, non-arrays).
- Type-specific:
  - `draft_delta`: requires `deltaText` string. Missing or wrong type should fail.
  - `final_answer`: requires `finalText` string.
  - `tool_call_started`/`tool_call_finished`: requires non-empty `toolName` string.
  - `fallback`: requires `fallbackReason` string.
- Must accept valid minimal events.
- Must accept valid events with optional fields.
- Must accept boundary values: confidence=0, confidence=1, publicSummary=240 chars, empty sourceIds array.

**Invariants for newEnvelope:**
- Must return object with all required base fields.
- `isSafeForUser` must be literal `true`.
- `timestamp` must be valid ISO string (or at least present).
- `role` must match `AGENT_ROLE_LABEL_TH` when `agentId` provided.
- `role` must be undefined when `agentId` omitted.
- Must not include extra undefined fields cluttering? Actually TypeScript will include undefined for optional fields if set. But the function only sets specific fields.
- Must handle all valid `AgentId` values.
- Must reject invalid `AgentId` at compile time (but runtime fuzzing with ts-ignore or cast could test behavior - it would produce `undefined` role if agentId not in map).

**Invariants for AGENT_ROLE_LABEL_TH:**
- Every `AgentId` enum value has a key in the record.
- Values are non-empty strings.

**Schema/Type invariants:**
- `AgentEventType` union and `allowedTypes` array in validator must stay in sync.
- `AgentId` union and `AGENT_ROLE_LABEL_TH` keys must stay in sync.

Let me structure the markdown list. The user wants: property → fuzz input → expected invariant.

I should organize by the property/invariant being tested, then the fuzz input, then the expected result.

Let me draft concrete entries:

1. **validateAgentEvent rejects non-objects**
   - Fuzz: `null`, `undefined`, `42`, `"string"`, `true`, `Symbol('x')`, `[]` (array), `() => {}`
   - Invariant: returns `"event is not an object"` for all non-object inputs.

2. **validateAgentEvent rejects missing or empty required string fields**
   - Fuzz: `{}`, `{type:''}`, `{type:'agent_delta', runId:'', messageId:'m', publicSummary:'s', timestamp:'t'}`, `{type:'agent_delta', runId:'r', messageId:'', publicSummary:'s', timestamp:'t'}`, etc. Also missing keys entirely.
   - Invariant: returns string starting with `"missing or empty required string field: ..."`

3. **validateAgentEvent rejects unknown event types**
   - Fuzz: `{type:'agent_run_startedd', runId:'r', messageId:'m', publicSummary:'s', timestamp:'t', isSafeForUser:true}` (typo), `'__proto__'`, `'constructor'`, `'toString'`, `'agent_delta\0'`, `'AGENT_DELTA'`, `''`, `' '`, `'final_answer' + ' '`, emoji, object injected as type via prototype pollution.
   - Invariant: returns `"unknown event type: ..."`

4. **validateAgentEvent enforces literal true for isSafeForUser**
   - Fuzz: `false`, `1`, `0`, `"true"`, `new Boolean(true)`, `{}`, `[]`, `undefined` (missing key), `2`, `-1`, `NaN`, `Infinity`
   - Invariant: returns `"isSafeForUser must be the literal true"`

5. **validateAgentEvent enforces publicSummary length boundary**
   - Fuzz: `'x'.repeat(241)`, `'x'.repeat(1000)`, `'x'.repeat(240)` (boundary), `''` (already covered by required field), string with multi-byte chars (Thai) where `.length` is 240 vs 241.
   - Invariant: >240 returns `"publicSummary exceeds 240 chars"`, ≤240 passes.

6. **validateAgentEvent enforces confidence numeric range [0,1]**
   - Fuzz: `-0.0001`, `1.0001`, `NaN`, `Infinity`, `-Infinity`, `null`, `"0.5"`, `{}`, `[]`, `2`, `-1`, `undefined` (should pass since optional), `0`, `1`, `0.5`
   - Invariant: non-number or out of range returns `"confidence must be 0..1"`, valid numbers pass.

7. **validateAgentEvent enforces sourceIds as string array**
   - Fuzz: `[1,2,3]`, `["a", null]`, `["a", 1]`, `{}`, `"string"`, `null`, `undefined` (should pass), `[]`, `[""]`, `["a","b"]`, nested arrays `[["a"]]`
   - Invariant: non-string array returns `"sourceIds must be string[]"`, valid string arrays pass.

8. **validateAgentEvent type-specific required fields - draft_delta**
   - Fuzz: `{type:'draft_delta', ...base, deltaText: undefined}`, `deltaText: null`, `deltaText: 123`, `deltaText: {}`, missing key entirely.
   - Invariant: returns `"draft_delta requires deltaText:string"`.

9. **validateAgentEvent type-specific required fields - final_answer**
   - Fuzz: `{type:'final_answer', ...base, finalText: undefined}`, `finalText: null`, `finalText: 123`, missing key.
   - Invariant: returns `"final_answer requires finalText:string"`.

10. **validateAgentEvent type-specific required fields - tool_call_started/finished**
    - Fuzz: `{type:'tool_call_started', ...base, toolName: ''}`, `toolName: undefined`, `toolName: 123`, `toolName: null`, `{type:'tool_call_finished', ...base, toolName: ''}`.
    - Invariant: returns `"tool_call_started requires toolName:string"` or finished variant.

11. **validateAgentEvent type-specific required fields - fallback**
    - Fuzz: `{type:'fallback', ...base, fallbackReason: undefined}`, `fallbackReason: 123`, missing key.
    - Invariant: returns `"fallback requires fallbackReason:string"`.

12. **validateAgentEvent accepts valid minimal events for all types**
    - Fuzz: For each `AgentEventType`, construct minimal valid payload with only required fields + type-specific fields where needed.
    - Invariant: returns `null` for all 16 event types.

13. **validateAgentEvent accepts valid maximal events**
    - Fuzz: Event with all optional fields populated correctly (confidence:0.5, sourceIds:['a'], agentId:'conductor', role:'ผู้กำกับงาน', etc.) for each type.
    - Invariant: returns `null`.

14. **newEnvelope produces valid AgentEvent base**
    - Fuzz: `newEnvelope({runId:'r', messageId:'m', type:'agent_delta', publicSummary:'s'})`
    - Invariant: output passes `validateAgentEvent` when supplemented with type-specific fields (if any), has `isSafeForUser:true`, ISO `timestamp`, correct `role` mapping.

15. **newEnvelope maps agentId to Thai role label**
    - Fuzz: Every `AgentId` value passed as `agentId`.
    - Invariant: `role` equals corresponding `AGENT_ROLE_LABEL_TH[agentId]`.

16. **newEnvelope omits role when agentId absent**
    - Fuzz: `newEnvelope({runId:'r', messageId:'m', type:'error', publicSummary:'s'})` (no agentId).
    - Invariant: `role` property is `undefined` (not present or explicitly undefined).

17. **newEnvelope handles unknown agentId gracefully**
    - Fuzz: Cast/force invalid agentId like `'hacker' as AgentId`.
    - Invariant: `role` is `undefined` (since not in map), no runtime exception.

18. **AGENT_ROLE_LABEL_TH completeness**
    - Fuzz: Iterate all `AgentId` union members.
    - Invariant: `AGENT_ROLE_LABEL_TH[id]` is defined and non-empty string for every id.

19. **Timestamp format invariant**
    - Fuzz: `newEnvelope` called at any time.
    - Invariant: `timestamp` is a valid ISO 8601 string parseable by `new Date()`.

20. **Schema version constant**
    - Fuzz: N/A (static), but invariant: `SCHEMA_VERSION` is `"1.0.0"`.

21. **Prototype pollution resistance in validateAgentEvent**
    - Fuzz: `JSON.parse('{"__proto__":{"isAdmin":true},"type":"error",...}')` or object with `constructor` prototype chain manipulation.
    - Invariant: Validator reads only own properties or behaves correctly; does not crash or return unexpected null.

22. **validateAgentEvent ignores extra fields**
    - Fuzz: Event with extra fields like `secretThoughts: 'leak'`, `rawModelOutput: '...'`, `isSafeForUser: true` but extra fields present.
    - Invariant: returns `null` (shape check only, per comment). This is important because eventGuard.ts is supposed to handle the safety scan.

23. **Boundary: publicSummary exactly 240 chars**
    - Fuzz: `'x'.repeat(240)` with various event types.
    - Invariant: `null` (passes).

24. **Boundary: confidence exactly 0 and 1**
    - Fuzz: `confidence: 0`, `confidence: 1`, `confidence: Number.MIN_VALUE`, `confidence: Number.MAX_VALUE` (wait MAX_VALUE > 1 so should fail). Actually `Number.EPSILON` near 0.
    - Invariant: 0 and 1 pass; >1 fails.

25. **newEnvelope publicSummary placeholder override**
    - Fuzz: `publicSummary: ''` (empty string).
    - Invariant: Validator would catch this, but `newEnvelope` itself accepts it (it's a builder). So the invariant is: `newEnvelope` does not validate, it just embeds the provided value.

26. **AgentEventType / allowedTypes sync**
    - Fuzz: Reflection/comparison of the `AgentEventType` union (at compile time) vs `allowedTypes` array at runtime.
    - Invariant: Array length equals union cardinality (16), every union member exists in array.

27. **sourceIds empty array**
    - Fuzz: `sourceIds: []`
    - Invariant: passes validation.

28. **Unicode and injection in string fields**
    - Fuzz: `publicSummary` containing newlines `\n`, RTL markers, zero-width joiners, SQL injection `' OR 1=1 --`, HTML `<script>alert(1)</script>`, 240 Thai chars (multi-byte).
    - Invariant: passes validation (shape check only), length check counts code units correctly (JS `.length`).

29. **runId / messageId format**
    - Fuzz: UUIDs, empty strings (should fail), very long strings, special chars.
    - Invariant: any non-empty string passes; empty string fails.

30. **agentId optional validation**
    - Fuzz: `agentId: 'conductor'` (valid), `agentId: 'invalid'`, `agentId: 123`, `agentId: null`, missing.
    - Invariant: `validateAgentEvent` does NOT validate `agentId` against the enum (looking at code, it doesn't check agentId at all!). Wait, looking at the code... indeed `validateAgentEvent` does not check `agentId` or `role`. So an invalid agentId string would pass. That's a property to test: validator is permissive on agentId.

Let me refine and select the most impactful ones. The user wants concrete, no filler. I'll aim for around 20-25 high-quality entries covering all major logic branches.

Format:
`- **PROPERTY**: [invariant] → **FUZZ INPUT**: [concrete input] → **EXPECTED INVARIANT**: [result]`

Actually the user said: "property → fuzz input → expected invariant". So maybe:
`- **Property**: [description] → **Fuzz Input**: [concrete] → **Expected**: [result]`

Let me make sure each is concrete. I'll provide actual JS object literals where possible.

Let's organize:

**Group 1: validateAgentEvent shape & required fields**
1. Non-object rejection
2. Empty/missing required strings
3. Unknown type rejection
4. isSafeForUser literal true enforcement
5. publicSummary max length
6. Confidence range
7. sourceIds string array

**Group 2: validateAgentEvent type-specific branches**
8. draft_delta deltaText
9. final_answer finalText
10. tool_call_started/finished toolName
11. fallback fallbackReason

**Group 3: validateAgentEvent boundaries & permissiveness**
12. publicSummary exactly 240
13. Confidence 0 and 1
14. sourceIds empty array
15. Extra fields ignored
16. agentId not validated (permissive)

**Group 4: newEnvelope construction**
17. Base envelope validity
18. Role mapping for all AgentIds
19. Role undefined when no agentId
20. Invalid agentId handled gracefully
21. Timestamp is ISO string

**Group 5: Cross-cutting / adversarial**
22. Prototype pollution object
23. Array instead of object
24. Malformed strings (HTML/JS/SQL injection in publicSummary)
25. Multi-byte Thai publicSummary boundary (240 chars vs bytes)

Let me write them out concisely.

Entry 1:
- **Property**: `validateAgentEvent` rejects all non-object inputs → **Fuzz Input**: `null`, `undefined`, `42`, `"event"`, `true`, `[]`, `() => {}` → **Expected Invariant**: always returns `"event is not an object"`

Entry 2:
- **Property**: `validateAgentEvent` rejects missing or empty required string fields → **Fuzz Input**: `{}`; `{type:"", runId:"r", messageId:"m", publicSummary:"s", timestamp:"t", isSafeForUser:true}`; `{type:"error", runId:"r", messageId:"", publicSummary:"s", timestamp:"t", isSafeForUser:true}` → **Expected Invariant**: returns `"missing or empty required string field: ..."` matching the first bad field

Entry 3:
- **Property**: `validateAgentEvent` rejects unknown event types �� **Fuzz Input**: `{type:"agent_run_startedd", runId:"r", messageId:"m", publicSummary:"s", timestamp:"t", isSafeForUser:true}`; `{type:"__proto__", ...}`; `{type:"", ...}` → **Expected Invariant**: returns `"unknown event type: ..."`

Entry 4:
- **Property**: `isSafeForUser` must be the literal boolean `true` → **Fuzz Input**: `false`, `1`, `"true"`, `new Boolean(true)`, `[]`, `{}`, `undefined` (key omitted from otherwise valid base) → **Expected Invariant**: returns `"isSafeForUser must be the literal true"`

Entry 5:
- **Property**: `publicSummary` length is capped at `PUBLIC_SUMMARY_MAX` (240) → **Fuzz Input**: `"x".repeat(241)`, `"x".repeat(1000)`, `"🙂".repeat(240)` (length 240), `"🙂".repeat(241)` (length 241) → **Expected Invariant**: >240 returns `"publicSummary exceeds 240 chars"`; ≤240 passes

Entry 6:
- **Property**: `confidence` is optional but must be a number in [0,1] when present → **Fuzz Input**: `-0.01`, `1.01`, `NaN`, `Infinity`, `-Infinity`, `"0.5"`, `null`, `0`, `1`, `0.5` → **Expected Invariant**: out-of-range/non-number returns `"confidence must be 0..1"`; valid numbers and `undefined` pass

Entry 7:
- **Property**: `sourceIds` must be an array of strings when present → **Fuzz Input**: `[1,2]`, `["a", null]`, `"a"`, `{}`, `[]`, `[""]`, `["src1","src2"]` → **Expected Invariant**: non-string-array returns `"sourceIds must be string[]"`; valid string arrays (including empty) pass

Entry 8:
- **Property**: `draft_delta` requires `deltaText` string → **Fuzz Input**: `{type:"draft_delta", runId:"r", messageId:"m", publicSummary:"s", timestamp:"t", isSafeForUser:true, deltaText:undefined}`; `deltaText:null`; `deltaText:123`; key omitted → **Expected Invariant**: returns `"draft_delta requires deltaText:string"`

Entry 9:
- **Property**: `final_answer` requires `finalText` string → **Fuzz Input**: `{type:"final_answer", ...base, finalText:undefined}`; `finalText:123`; key omitted → **Expected Invariant**: returns `"final_answer requires finalText:string"`

Entry 10:
- **Property**: `tool_call_started` and `tool_call_finished` require non-empty `toolName` string → **Fuzz Input**: `{type:"tool_call_started", ...base, toolName:""}`; `toolName:undefined`; `{type:"tool_call_finished", ...base, toolName:123}` → **Expected Invariant**: returns `"tool_call_started requires toolName:string"` / `"tool_call_finished requires toolName:string"`

Entry 11:
- **Property**: `fallback` requires `fallbackReason` string → **Fuzz Input**: `{type:"fallback", ...base, fallbackReason:undefined}`; `fallbackReason:123`; key omitted → **Expected Invariant**: returns `"fallback requires fallbackReason:string"`

Entry 12:
- **Property**: Valid minimal events for every `AgentEventType` pass validation → **Fuzz Input**: Iterate all 16 types with minimal required fields plus type-specific fields (`draft_delta` gets `deltaText`, etc.) → **Expected Invariant**: `validateAgentEvent` returns `null` for every type

Entry 13:
- **Property**: Validator ignores superfluous extra fields (shape-only check) → **Fuzz Input**: Valid base event with added `secretThoughts:"leak"`, `rawModelOutput:"..."`, `__proto__:{polluted:true}` → **Expected Invariant**: returns `null`

Entry 14:
- **Property**: `agentId` and `role` are not validated against the enum by `validateAgentEvent` → **Fuzz Input**: `{...base, agentId:"hacker", role:"impostor"}`; `agentId:123`; `role:null` → **Expected Invariant**: returns `null` (permissive shape check)

Entry 15:
- **Property**: `newEnvelope` produces a validator-passing base event when completed with required type-specific fields → **Fuzz Input**: `newEnvelope({runId:"r", messageId:"m", type:"agent_delta", publicSummary:"s"})` then add `deltaText:"d"` → **Expected Invariant**: `validateAgentEvent` returns `null`

Entry 16:
- **Property**: `newEnvelope` maps every valid `AgentId` to its Thai `role` label via `AGENT_ROLE_LABEL_TH` → **Fuzz Input**: `agentId` cycled through all 16 IDs (`"conductor"`, `"concierge"`, ..., `"data-analyst"`) → **Expected Invariant**: `role` equals the corresponding Thai string and `AGENT_ROLE_LABEL_TH` entry is non-empty

Entry 17:
- **Property**: `newEnvelope` omits `role` when `agentId` is absent → **Fuzz Input**: `newEnvelope({runId:"r", messageId:"m", type:"error", publicSummary:"s"})` → **Expected Invariant**: `role` is `undefined` and object contains no unexpected role property (or explicitly `undefined`)

Entry 18:
- **Property**: `newEnvelope` survives an unknown `agentId` without throwing → **Fuzz Input**: `newEnvelope({runId:"r", messageId:"m", type:"error", publicSummary:"s", agentId:"unknown-id" as AgentId})` → **Expected Invariant**: `role` is `undefined`, no exception thrown

Entry 19:
- **Property**: `newEnvelope` timestamp is a valid ISO-8601 string → **Fuzz Input**: Call `newEnvelope` at runtime; inspect `timestamp` → **Expected Invariant**: `new Date(envelope.timestamp).toISOString() === envelope.timestamp` (or at least `!isNaN(Date.parse(...))`)

Entry 20:
- **Property**: `AGENT_ROLE_LABEL_TH` contains a key for every declared `AgentId` → **Fuzz Input**: Runtime reflection / type-level check comparing `AgentId` union members to `Object.keys(AGENT_ROLE_LABEL_TH)` → **Expected Invariant**: count is 16 and every `AgentId` value has a defined string value

Entry 21:
- **Property**: `validateAgentEvent` is safe against prototype-polluted inputs → **Fuzz Input**: `JSON.parse('{"__proto__":{"isAdmin":true},"type
