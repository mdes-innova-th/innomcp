<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-014 role=fuzz model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":3141,"completion_tokens":4147,"total_tokens":7288,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":757,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 37s
 generated: 2026-06-13T12:02:12.050Z -->
# Property-Based & Fuzz Test Cases for `intentClassifier.ts`

## 1. Determinism

- **Property: Same input always yields same output** → fuzz: random strings of 0–500 chars, run `classifyIntent(x)` twice → invariant: result deep-equals itself
- **Property: Order of calls doesn't affect result** → fuzz: generate two messages `a`, `b`; classify `a` then `b` then `a` again → invariant: `classifyIntent(a)` result is identical both times

## 2. Output Shape / Type Invariants

- **Property: `intent` is always a valid ChatIntent** → fuzz: random strings (Thai, English, mixed, unicode, empty, symbols) → invariant: result.intent ∈ ChatIntent union
- **Property: `expectedToolUsage` is always boolean** → fuzz: any string input → invariant: `typeof result.expectedToolUsage === "boolean"`
- **Property: `reasons` is always a non-empty string array** → fuzz: any string input including `""` → invariant: `Array.isArray(result.reasons) && result.reasons.length > 0 && result.reasons.every(r => typeof r === "string")`

## 3. Empty / Invalid Input Handling

- **Property: Empty string → general intent** → fuzz: `""` → invariant: `intent === "general" && expectedToolUsage === false`
- **Property: Whitespace-only string → general intent** → fuzz: `"   "`, `"\t\n"`, `"\u00A0\u2000"` → invariant: `intent === "general"`
- **Property: Non-string input → general intent** → fuzz: `undefined`, `null`, `123`, `{}`, `[]`, `NaN` (cast to `any`) → invariant: `intent === "general" && expectedToolUsage === false && reasons === ["empty"]`
- **Property: String with only zero-width characters** → fuzz: `"\u200B\u200C\u200D\uFEFF"` → invariant: `intent === "general"`

## 4. Case Insensitivity

- **Property: Keyword matching is case-insensitive** → fuzz: `"WEATHER"`, `"Weather"`, `"wEaThEr"`, `"FORENSIC"`, `"NIP"`, `"ISP"` → invariant: same intent as lowercase equivalent
- **Property: Thai keywords are not case-folded incorrectly** → fuzz: Thai text with mixed Latin/Thai → invariant: Thai keyword matches still work (Thai has no case, so no false negatives)

## 5. Keyword Presence Triggers Correct Intent

- **Property: Each keyword in PLANNING_KEYWORDS triggers planning-broad** → fuzz: `"วางแผน"`, `"plan"`, `"shortlist"`, `"rank"` → invariant: `intent === "planning-broad"`
- **Property: Each keyword in WEATHER_KEYWORDS triggers weather** → fuzz: `"อากาศ"`, `"forecast"`, `"rain"`, `"temperature"` → invariant: `intent === "weather"`
- **Property: Each keyword in DATETIME_KEYWORDS triggers datetime** → fuzz: `"กี่โมง"`, `"what time"`, `"clock"`, `"วันนี้วัน"` → invariant: `intent === "datetime"`
- **Property: Each keyword in CALC_KEYWORDS triggers calc** → fuzz: `"คำนวณ"`, `"calculate"`, `"%"`, `"mean"` → invariant: `intent === "calc"`
- **Property: Each keyword in CODE_KEYWORDS triggers code** → fuzz: `"function"`, `"regex"`, `"python"`, `"type error"` → invariant: `intent === "code"`
- **Property: Each keyword in MAP_KEYWORDS triggers map** → fuzz: `"แผนที่"`, `"coordinates"`, `"map"` → invariant: `intent === "map"`
- **Property: Each keyword in SHELL_KEYWORDS triggers shell** → fuzz: `"npm"`, `"bash"`, `"mkdir"`, `"deploy"` → invariant: `intent === "shell"`
- **Property: Each keyword in WRITE_KEYWORDS triggers write** → fuzz: `"เขียน"`, `"draft"`, `"summarize"`, `"email"` → invariant: `intent === "write"`
- **Property: Each keyword in DATA_KEYWORDS triggers data** → fuzz: `"csv"`, `"excel"`, `"กราฟ"`, `"statistic"` → invariant: `intent === "data"`
- **Property: Each keyword in RESEARCH_KEYWORDS triggers research** → fuzz: `"search"`, `"find"`, `"ค้นหา"`, `"about"` → invariant: `intent === "research"`
- **Property: Each keyword in GREETING_KEYWORDS triggers greeting** → fuzz: `"สวัสดี"`, `"hello"`, `"yo"`, `"ฮัลโหล"` → invariant: `intent === "greeting"`

## 6. Evidence Intent — Special Guard Logic

- **Property: Unambiguous evidence keywords always trigger evidence** → fuzz: `"หลักฐาน"`, `"คดี"`, `"forensic"`, `"evidence"` → invariant: `intent === "evidence"`
- **Property: "machine" alone does NOT trigger evidence** → fuzz: `"machine learning is cool"`, `"what is a machine"` → invariant: `intent !== "evidence"`
- **Property: "machine" WITH officer signal DOES trigger evidence** → fuzz: `"machine forensic"`, `"machine หลักฐาน"`, `"detect machine"` → invariant: `intent === "evidence"`
- **Property: "url" alone does NOT trigger evidence** → fuzz: `"url encoding"`, `"check this url"` → invariant: `intent !== "evidence"`
- **Property: "url" WITH officer signal DOES trigger evidence** → fuzz: `"url evidence"`, `"url คดี"`, `"ISP url"` → invariant: `intent === "evidence"`
- **Property: "traffic" alone does NOT trigger evidence** → fuzz: `"network traffic"`, `"traffic jam"` → invariant: `intent !== "evidence"`
- **Property: "traffic" WITH officer signal DOES trigger evidence** → fuzz: `"traffic forensic"`, `"traffic สแกน"` → invariant: `intent === "evidence"`
- **Property: "machine learning" is explicitly excluded** → fuzz: `"machine learning forensic"` → invariant: `intent !== "evidence"` (the regex exclusion takes priority)
- **Property: "url encoding" is explicitly excluded** → fuzz: `"url encoding evidence"` → invariant: `intent !== "evidence"`
- **Property: "url คืออะไร" is explicitly excluded** → fuzz: `"url คืออะไร"` → invariant: `intent !== "evidence"` (should be knowledge)
- **Property: NIP/ISP are always evidence (unambiguous)** → fuzz: `"NIP"`, `"ISP"`, `"nip"` → invariant: `intent === "evidence"`

## 7. Overlapping Keywords / Priority Conflicts

- **Property: "ทริป" appears in both PLANNING and TRAVEL — first-checked category wins** → fuzz: `"ทริป"` → invariant: intent is consistently one of `planning-broad` or `travel` (deterministic, never random)
- **Property: "เปรียบเทียบ" in both PLANNING and DATA** → fuzz: `"เปรียบเทียบ"` → invariant: intent is deterministic and consistent
- **Property: "หุ้น" in both KNOWLEDGE and FACTUAL** → fuzz: `"หุ้น"` → invariant: intent is deterministic and consistent
- **Property: "วิทยาศาสตร์" in both KNOWLEDGE and FACTUAL** → fuzz: `"วิทยาศาสตร์"` → invariant: deterministic resolution
- **Property: "travel" in both TRAVEL and FACTUAL** → fuzz: `"travel"` → invariant: deterministic resolution
- **Property: "เที่ยว" in TRAVEL only (not FACTUAL)** → fuzz: `"เที่ยว"` → invariant: `intent === "travel"`
- **Property: "ท่องเที่ยว" in both TRAVEL and FACTUAL** → fuzz: `"ท่องเที่ยว"` → invariant: deterministic resolution
- **Property: "สุขภาพ" in both KNOWLEDGE and FACTUAL** → fuzz: `"สุขภาพ"` → invariant: deterministic resolution
- **Property: "ประวัติศาสตร์" in both KNOWLEDGE and FACTUAL** → fuzz: `"ประวัต��ศาสตร์"` → invariant: deterministic resolution

## 8. Multi-Intent / Compound Messages

- **Property: Message with keywords from multiple categories resolves to one intent** → fuzz: `"วางแผนอากาศวันนี้"` (planning + weather + datetime) → invariant: `typeof result.intent === "string"` and result.intent is exactly one ChatIntent
- **Property: Greeting + substantive keyword** → fuzz: `"สวัสดี อากาศเป็นยังไง"` → invariant: intent is deterministic (either greeting or weather, consistently)
- **Property: Long message with keyword buried deep** → fuzz: `"blah " * 1000 + "weather"` → invariant: `intent === "weather"` (substring match should still find it)

## 9. Adversarial / Boundary Inputs

- **Property: Very long string doesn't crash** → fuzz: `"x" * 100000` → invariant: returns valid ClassifyResult, no exception
- **Property: String with null bytes** → fuzz: `"wea\x00ther"` → invariant: returns valid ClassifyResult (likely general since "weather" is split)
- **Property: Unicode normalization attack** → fuzz: `"we\u0061ther"` (standard compose) vs `"we\u00E1ther"` (different char) → invariant: first matches weather, second does not
- **Property: Thai with combining characters** → fuzz: `"อากาศ" + "\u0E33\u0E4D"` (combining marks) → invariant: still matches weather intent
- **Property: Keyword embedded in larger word** → fuzz: `"weatherization"` → invariant: `intent === "weather"` (substring match catches it)
- **Property: Keyword as part of unrelated word** → fuzz: `"maple syrup"` → invariant: `intent === "map"` (potential false positive — document this as known behavior)
- **Property: Repeated keywords** → fuzz: `"weather weather weather"` → invariant: `intent === "weather"`
- **Property: Keyword in reversed order** → fuzz: `"forecast weather"` → invariant: `intent === "weather"` or `"general"` depending on priority
- **Property: Mixed script homoglyphs** → fuzz: `"wеather"` (Cyrillic 'е') → invariant: `intent !== "weather"` (no false match on homoglyph)
- **Property: HTML/JS injection in message** → fuzz: `"<script>alert('weather')</script>"` → invariant: no crash, intent is "general" (no keyword match)
- **Property: Emoji-only input** → fuzz: `"🌤️🌧️"` → invariant: `intent === "general"` (no text keyword)
- **Property: Keyword surrounded by Zalgo text** → fuzz: `"z̸̢a̷̡l̶̡g̷̢o̸̢ weather z̸̢a̷̡l̶̡g̷̢o̸̢"` → invariant: `intent === "weather"`
- **Property: String with only punctuation** → fuzz: `"!@#$%^&*()"` → invariant: `intent === "general"`
- **Property: "ตอนนี้" is removed from DATETIME — should not trigger datetime alone** → fuzz: `"ตอนนี้"` → invariant: `intent !== "datetime"` (unless matched by another keyword list)
- **Property: "ขณะนี้" IS in DATETIME** → fuzz: `"ขณะนี้"` → invariant: `intent === "datetime"`
- **Property: "traffic" (English) removed from TRAVEL — should not trigger travel** → fuzz: `"traffic"` → invariant: `intent !== "travel"` (may be evidence if officer signal present, else general)
- **Property: "การจราจร" (Thai traffic) IS in TRAVEL** → fuzz: `"การจราจร"` → invariant: `intent === "travel"`

## 10. toolHint Influence

- **Property: toolHint can override or bias classification** → fuzz: `classifyIntent("hello", "weather-tool")` → invariant: returns valid ClassifyResult (document whether toolHint changes intent)
- **Property: toolHint is undefined** → fuzz: `classifyIntent("weather")` (no toolHint) → invariant: `intent === "weather"`
- **Property: toolHint is empty string** → fuzz: `classifyIntent("weather", "")` → invariant: same result as undefined toolHint

## 11. expectedToolUsage Correctness

- **Property: Greeting never expects tool usage** → fuzz: any greeting-only message → invariant: `expectedToolUsage === false`
- **Property: Weather always expects tool usage** → fuzz: `"อากาศวันนี้"` → invariant: `expectedToolUsage === true`
- **Property: Datetime expects tool usage** → fuzz: `"กี่โมง"` → invariant: `expectedToolUsage === true`
- **Property: Calc expects tool usage** → fuzz: `"คำนวณ 2+2"` → invariant: `expectedToolUsage === true`
- **Property: General intent never expects tool usage** → fuzz: `"blah blah"` → invariant: `expectedToolUsage === false`
- **Property: Knowledge may or may not expect tool usage** → fuzz: `"คืออะไร"` → invariant: `typeof result.expectedToolUsage === "boolean"`

## 12. Substring Matching Edge Cases

- **Property: Partial keyword does not match** → fuzz: `"weath"` → invariant: `intent !== "weather"`
- **Property: Keyword is exact match in longer string** → fuzz: `"the weather today"` → invariant: `intent === "weather"`
- **Property: Keyword at start of string** → fuzz: `"weather today"` → invariant: `intent === "weather"`
- **Property: Keyword at end of string** → fuzz: `"today's weather"` → invariant: `intent === "weather"`
- **Property: Keyword is entire string** → fuzz: `"weather"` → invariant: `intent === "weather"`
- **Property: "%" in CALC_KEYWORDS matches percentage** → fuzz: `"50% discount"` → invariant: `intent === "calc"` (known false-positive risk)
- **Property: "ls" in SHELL_KEYWORDS matches as substring** → fuzz: `"false"` → invariant: `intent === "shell"` (contains "ls" — document as known false positive)
- **Property: "run" in SHELL_KEYWORDS matches as substring** → fuzz: `"running late"` → invariant: `intent === "shell"` (known false positive)
- **Property: "start" in SHELL_KEYWORDS matches as substring** → fuzz: `"startled"` → invariant: `intent === "shell"` (known false positive)
- **Property: "fact" in KNOWLEDGE matches as substring** → fuzz: `"factory"`, `"fact"` → invariant: both match knowledge intent (substring match)
- **Property: "nip" case-insensitive in EVIDENCE** → fuzz: `"Nip"`, `"NIP"`, `"nip"` → invariant: all trigger evidence intent
