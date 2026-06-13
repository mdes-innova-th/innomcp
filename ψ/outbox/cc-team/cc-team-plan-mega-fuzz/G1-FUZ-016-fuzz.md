<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-016 role=fuzz model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1418,"completion_tokens":4071,"total_tokens":5489,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2788,"image_tokens":0},"cache_creation_input_tokens":0} | 45s
 generated: 2026-06-13T12:02:57.348Z -->
## Property-Based / Fuzz Test Cases for `naturalnessGuard.ts`

| Property | Fuzz Input | Expected Invariant |
|---|---|---|
| Non‑string candidate returns error | `null` / `undefined` / `42` / `[]` | `result.ok === false` and `result.ruleFired === "empty-answer"` |
| Empty string answer | `""` | `result.ok === false` and `result.ruleFired === "empty-answer"` |
| Whitespace‑only answer leaks past empty‑answer rule | `"   "` (spaces, tabs, newlines) with `intent: "planning-broad"` | `result.ok === false` and `result.ruleFired === "planning-broad-too-shallow"` (empty trimmed string fails follow‑up/plan‑frame check) |
| Exact province‑request match for `planning‑broad` | `"กรุณาระบุจังหวัดเชียงใหม่"` (intent = `planning-broad`) | `result.ruleFired === "planning-broad-province-only"` |
| Province‑request with trailing newline bypass (trim removes) | `"กรุณาระบุจังหวัด\n"` (intent = `planning-broad`) | `result.ruleFired === "planning-broad-province-only"` (newline is trimmed) |
| Province‑request with newline in middle bypasses regex | `"กรุณาระบุจังหวัด\nข้อมูลเพิ่มเติม"` (intent = `planning-broad`) | `result.ruleFired` is **not** `"planning-broad-province-only"` (regex `$` fails) |
| Thai query / English‑first answer (first 50 chars no Thai) | `userQuery: "สวัสดี"`, `candidate: "Hello, this is English without Thai in first 50 chars..."` | `result.ruleFired === "english-first-leak"` |
| Thai query / English‑first answer with Thai character in first 50 (bypass) | `userQuery: "สวัสดี"`, `candidate: "Hello สวัสดีแล้ว..."` (Thai at position 7) | `result.ok === true` (rule condition `!hasThaiCharacter(trimmed.slice(0,50))` is false) |
| Non‑Thai user query / English‑first answer (rule not applicable) | `userQuery: "hello"`, `candidate: "Hello world"` | `result.ok === true` (userIsThai is false) |
| Raw JSON leak (object) | `'{"key":"value"}'` (any intent) | `result.ruleFired === "raw-json-leak"` |
| Raw JSON leak (array) | `'["item1","item2"]'` | `result.ruleFired === "raw-json-leak"` |
| JSON‑like with single quotes bypasses regex | `"{ 'key': 'value' }"` | `result.ok === true` (after `{` regex expects `"` not `'`) |
| JSON with leading character bypasses regex | `"a{\"key\":1}"` | `result.ok === true` (first non‑whitespace char is `a`) |
| Guard violation: `"Used tools: none"` in answer | `"Here: Used tools: none"` (expectedToolUsage = true, intent ≠ map) | `result.ruleFired === "forbidden-substring:Used tools: none"` |
| Guard violation: map placeholder when intent ≠ map | `"ดูบนแผนที่ [{lat,lng}]"` (intent = `planning-broad`) | `result.ruleFired` starts with `"forbidden-substring:"` |
| Map placeholder allowed when intent = map | `"ดูบนแผนที่ [{lat,lng}]"` (intent = `map`) | `result.ok === true` (guard allows map terms) |
| `planning-broad` answer with only `?` (bypasses shallow check) | `"?"` (intent = `planning-broad`) | `result.ok === true` (hasFollowup true via `\?`) |
| `planning-broad` answer with only `มีคำถาม` (bypasses) | `"มีคำถามไหม?"` | `result.ok === true` (hasFollowup true) |
| `planning-broad` answer with plan frame present | `"แนวทางคือ...` | `result.ok === true` (hasPlanFrame true) |
| `planning-broad` answer missing both follow‑up and plan frame | `"แค่นี้"` (intent = `planning-broad`) | `result.ruleFired === "planning-broad-too-shallow"` |
| Province‑request answer with **non**‑`planning-broad` intent | `"กรุณาระบุจังหวัด"` (intent = `general`) | `result.ruleFired` is **not** `"planning-broad-province-only"` (rule only applies to `planning-broad`) |
| Extremely long answer (buffer overflow? no, but performance) | `"a".repeat(100000)` (any intent) | `result.ok === true` (no error, passes all checks) |
| Unicode control characters / invisible characters | `"\u200B\u200C\u200D"` (zero‑width spaces) with intent `planning-broad` | `result.ruleFired === "planning-broad-too-shallow"` (trim removes nothing, no Thai, no follow‑up) |
| Answer with emoji causing regex quirks | `"😀สวัสดี"` (userQuery Thai, answer starts with emoji, not English) | `result.ok === true` (startsWithEnglish false) |
