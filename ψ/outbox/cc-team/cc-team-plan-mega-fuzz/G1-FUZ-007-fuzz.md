<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-007 role=fuzz model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":2371,"completion_tokens":3195,"total_tokens":5566,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2226,"image_tokens":0},"cache_creation_input_tokens":0} | 60s
 generated: 2026-06-13T12:00:16.764Z -->
- **Math Expression Safety** → `"คำนวณ บวก ลบ คูณ หาร ยกกำลัง เปอร์เซ็นต์"` (no digits) → Output contains no Thai math keywords; returns empty string or original stripped text; never throws.
- **Math Expression Average Fallback** → `"ค่าเฉลี่ย ของ a b c"` (no digits with 'average') �� Output does not contain `mean([])`; returns original stripped text.
- **Math Expression Thousand Separators** → `"1,000,000 + 2,000"` → Commas acting as thousand separators are removed; output is strictly `"1000000 + 2000"`.
- **Regex Catastrophic Backtracking (ReDoS)** → `"(" * 5000 + ")" * 5000` or `"a" + " ".repeat(10000) + "b"` → Execution completes in < 50ms; no ReDoS exception thrown.
- **Hourly Weather Fallback** → `"อากาศตอนนี้ดีไหม"` (current weather without 'hour' keyword) → `needsHourlyWeather` returns `false`; `planToolCall` routes to `nwp_daily_by_place`.
- **Hourly Weather Trigger** → `"อากาศรายชั่วโมงวันนี้"` → `needsHourlyWeather` returns `true`; `planToolCall` routes to `nwp_hourly_by_place` with `duration: 24`.
- **Evidence Action Default** → `"สวัสดีครับ"` (no evidence keywords) → `inferEvidenceAction` strictly returns `"officer_summary"`.
- **Evidence Action Priority** → `"machine offline yesterday"` (conflicting keywords) → `inferEvidenceAction` returns `"active_machines_offline_count"` (first regex match wins).
- **ISP Filter Case & Boundary** → `"AIS DtAc TRUE tot 3bb NT"` → `extractIspFilter` returns the first matched ISP strictly in lowercase (e.g., `"ais"`).
- **ISP Filter Invalid** → `"cat dog mouse"` → `extractIspFilter` strictly returns `undefined`.
- **Data Payload Fenced CSV** → ```` ```csv\na,b\n1,2\n``` ```` → `dataFormat` is `"csv"`, `dataPayload` is `"a,b\n1,2"`, `questionText` is empty.
- **Data Payload Fenced JSON Hint (Malformed)** → ```` ```json\nnot valid json\n``` ```` → `dataFormat` is `"json"`, `dataPayload` is `"not valid json"` (does not throw on invalid JSON inside fences).
- **Data Payload Bare JSON Invalid** → `"[{a:1}] what is this"` (invalid JSON syntax) → Falls back to empty `dataPayload`, `dataFormat` is `"csv"`, `questionText` is the full original string.
- **Data Payload Bare JSON Valid** → `'[{"a":1}] calculate sum'` → `dataFormat` is `"json"`, `dataPayload` is `'[{"a":1}]'`, `questionText` is `"calculate sum"`.
- **Data Payload Unclosed Fence** → ```` ```csv\ndata ```` (no closing backticks) → `dataPayload` is empty, treats entire string as `questionText`.
- **Evidence Signal Machine Alone** → `"machine"` or `"url"` (isolated keywords) → `hasEvidenceSignal` strictly returns `false`.
- **Evidence Signal Machine Context** → `"machine offline"` or `"url detect"` → `hasEvidenceSignal` strictly returns `true`.
- **Plan Tool Call Null Intent** → `intent: "chitchat"`, `query: "hello"` → `planToolCall` strictly returns `null`.
- **Plan Tool Call Weather Default Province** → `intent: "weather"`, `query: "อากาศเป็นอย่างไร"` (no province mentioned) → `args.province` strictly defaults to `"กรุงเทพมหานคร"`.
- **Plan Tool Call Map Fallback** → `intent: "map"`, `query: "where is this"` (no province extracted) → `args.query` strictly falls back to the full trimmed query string.
- **Plan Tool Call Structural Invariant** → Any valid `intent` and arbitrary `query` string (including empty/null chars) → If return is not `null`, object strictly contains `toolName` (non-empty string), `args` (non-null object), `reason` (string), `authoritative` (boolean).
