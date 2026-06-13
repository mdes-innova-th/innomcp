<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-021 role=fuzz model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1507,"completion_tokens":2827,"total_tokens":4334,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1335,"image_tokens":0},"cache_creation_input_tokens":0} | 36s
 generated: 2026-06-13T12:04:24.396Z -->
- **Property**: Empty facts returns preset Thai apology with `mode: "passthrough"`, `factCount: 0`, and reason `"no-facts"`  
  - **Fuzz input**: `{ route: "test", userQuery: "อะไรก็ได้", facts: [] }`  
  - **Expected invariant**: output.text === `"ขออภัย ไม่พบข้อมูลที่เกี่ยวข้องในขณะนี���"`, output.mode === `"passthrough"`, output.reasons includes `"no-facts"`, output.factCount === 0, output.latencyMs is a non‑negative number.

- **Property**: All facts have empty/whitespace-only summary → treated as empty  
  - **Fuzz input**: `{ route: "x", userQuery: "", facts: [{ source: "src", summary: "   " }, { source: "s2", summary: "\n\t" }] }`  
  - **Expected invariant**: same as empty‑facts output; no facts rendered.

- **Property**: Single fact with `confidence` ≥ 0.6 renders without confidence suffix  
  - **Fuzz input**: `{ route: "w", userQuery: "ฝน", facts: [{ source: "tmd", summary: "ฝนตก", confidence: 0.88 }] }`  
  - **Expected invariant**: output.text === `"• **tmd**: ฝนตก"`, output.mode === `"deterministic"`, output.factCount === 1, reasons include `"composed:1"`.

- **Property**: Fact with `confidence` between 0.3 and 0.6 shows Thai confidence note  
  - **Fuzz input**: `{ facts: [{ source: "api", summary: "ข้อมูล", confidence: 0.45 }] }`  
  - **Expected invariant**: output.text includes `" _(ความมั่นใจ 45%)_"` after the summary.

- **Property**: Low‑confidence facts (<0.3) are dropped when any fact ≥ 0.3 exists  
  - **Fuzz input**: `{ facts: [{ source: "a", summary: "สูง", confidence: 0.9 }, { source: "b", summary: "ต่ำ", confidence: 0.2 }] }`  
  - **Expected invariant**: output.factCount === 1, output.text contains only "สูง", reasons includes `"dropped-low-conf:1"`.

- **Property**: All facts have confidence < 0.3 → none dropped, all rendered  
  - **Fuzz input**: `{ facts: [{ summary: "ต่ำ1", confidence: 0.1 }, { summary: "ต่ำ2", confidence: 0.29 }] }`  
  - **Expected invariant**: output.factCount === 2, reasons does **not** contain any `"dropped-low-conf"`, both summaries appear as separate bullets.

- **Property**: Confidence exactly 0.3 is kept (threshold inclusive)  
  - **Fuzz input**: `{ facts: [{ summary: "edge", confidence: 0.3 }] }`  
  - **Expected invariant**: output.factCount === 1, fact rendered.

- **Property**: Fact with `confidence === 0` treated as low but kept if only fact  
  - **Fuzz input**: `{ facts: [{ summary: "ศูนย์", confidence: 0 }] }`  
  - **Expected invariant**: output.factCount === 1, fact appears (since all facts are low, no drop).

- **Property**: Missing or empty `source` produces no source label  
  - **Fuzz input**: `{ facts: [{ summary: "ไม่มีแหล่ง", source: "" }, { summary: "ไม่มี source field" }] }`  
  - **Expected invariant**: both lines start with `"• "` directly followed by Thai summary, no bold label.

- **Property**: Optional `header` and `footer` are rendered exactly once in correct positions  
  - **Fuzz input**: `{ header: "หัวข้อ", footer: "เชิงอรรถ", facts: [{ summary: "ข้อมูล" }] }`  
  - **Expected invariant**: output.text === `"หัวข้อ\n\n• ข้อมูล\n\nเชิงอรรถ"` (exact string after trimming trailing newline).

- **Property**: Fact summary whitespace normalisation (multiple spaces, newlines → single space)  
  - **Fuzz input**: `{ facts: [{ summary: "   หลาย   \nบรรทัด   " }] }`  
  - **Expected invariant**: rendered summary in output is `"หลาย บรรทัด"` (space‑separated).

- **Property**: `route` is recorded in reasons even when empty  
  - **Fuzz input**: `{ route: "", facts: [{ summary: "test" }] }`  
  - **Expected invariant**: output.reasons includes `"route:"`.

- **Property**: Non‑array `facts` (e.g., `null`, `undefined`, string) treated as empty  
  - **Fuzz input**: `{ facts: null }` (or `undefined`, or `"not array"`)  
  - **Expected invariant**: output.factCount === 0, mode `"passthrough"`, no error thrown.

- **Property**: `confidence` is `NaN` – dropped only if other high‑confidence fact exists, kept otherwise  
  - **Fuzz input (with high fact)**: `{ facts: [{ summary: "good", confidence: 0.5 }, { summary: "nan", confidence: NaN }] }`  
  - **Expected invariant**: output.factCount === 1, "nan" not present.  
  - **Fuzz input (all NaN)**: `{ facts: [{ summary: "nan1", confidence: NaN }, { summary: "nan2", confidence: NaN }] }`  
  - **Expected invariant**: output.factCount === 2, both rendered because no high‑confidence alternative exists.

- **Property**: `latencyMs` is always a finite non‑negative number  
  - **Fuzz input**: any valid or invalid input  
  - **Expected invariant**: `typeof output.latencyMs === "number"`, `output.latencyMs >= 0`, `isFinite(output.latencyMs)`.

- **Property**: Input object is not mutated by the compose function  
  - **Fuzz input**: a deep‑cloned input object  
  - **Expected invariant**: after call, stringified input matches original clone.

- **Property**: `composeThaiAnswerWithLLM` falls back to deterministic and returns identical output  
  - **Fuzz input**: any `ResponseComposerInput`  
  - **Expected invariant**: `deepEqual(composeThaiAnswer(input), await composeThaiAnswerWithLLM(input))` (ignoring `latencyMs` jitter, or allow small difference).
