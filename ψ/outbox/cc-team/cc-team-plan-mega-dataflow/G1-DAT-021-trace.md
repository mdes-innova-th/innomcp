<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-021 role=trace model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1498,"completion_tokens":1956,"total_tokens":3454,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1053,"image_tokens":0},"cache_creation_input_tokens":0} | 93s
 generated: 2026-06-13T12:03:53.668Z -->
**Data-flow trace for `responseComposer.ts` / `composeThaiAnswer`**

1. **Entry point**: Caller (e.g., a route handler) invokes `composeThaiAnswer(input)` with a `ResponseComposerInput` object.
   - **Shape**: `{ route: string, userQuery: string, facts: ToolFact[], header?: string, footer?: string }`
   - `facts` is an array of `ToolFact`: `{ source: string, summary: string, confidence?: number, metadata?: Record<string,unknown> }`

2. **Start timer**: `const t0 = Date.now()` to measure latency.

3. **Initialize reasons array**: empty `string[]`.

4. **Normalize facts array**: If `input.facts` is falsy or not an array, set `facts` to `[]`; else use `input.facts`.

5. **Trim and filter empty summaries**:
   - Map each fact: replace all whitespace sequences with a single space and trim.
   - Filter out facts whose trimmed summary is empty (`length === 0`).
   - Result: `usable` array of `ToolFact` with cleaned summaries.

6. **Empty-facts early exit**:
   - If `usable.length === 0`:
     - Add reason `"no-facts"`.
     - Return `ResponseComposerOutput`:
       ```json
       {
         "text": "ขออภัย ไม่พบข้อมูลที่เกี่ยวข้องในขณะนี้",
         "mode": "passthrough",
         "reasons": ["no-facts"],
         "latencyMs": Date.now() - t0,
         "factCount": 0
       }
       ```
     - **(Skip remaining steps)**

7. **Confidence filtering**:
   - `highConf` = `usable` filtered where `Number(f.confidence ?? 1) >= 0.3`.
   - `rendered` = `highConf` if it’s non-empty, else `usable`.
   - If `rendered.length < usable.length`, push reason `"dropped-low-conf:<N>"` where N = number dropped.

8. **Build output lines array**:
   - If `input.header` is truthy and its trimmed form is non-empty:
     - Push `input.header.trim()`.
     - Push an empty string `""` (blank line).
   - For each fact `f` in `rendered`:
     - Compute confidence suffix: if `f.confidence` is a number and `< 0.6`, use `" _(ความมั่นใจ " + (f.confidence*100).toFixed(0) + "%)_"`; else `""`.
     - Compute source prefix: if `f.source` is truthy, use `"**" + f.source + "**: "`; else `""`.
     - Build line: `"• " + source_prefix + f.summary + confidence_suffix`.
     - Push line.
   - If `input.footer` is truthy and trimmed non-empty:
     - Push an empty line `""`.
     - Push `input.footer.trim()`.

9. **Append diagnostic reasons**:
   - `"composed:<rendered.length>"`.
   - `"route:<input.route || 'unknown'>"`.

10. **Form final text**: Join all lines with `"\n"` and trim the result.

11. **Compute latency**: `Date.now() - t0`.

12. **Construct and return `ResponseComposerOutput`**:
    ```json
    {
      "text": "<composed string>",
      "mode": "deterministic",
      "reasons": [...],
      "latencyMs": <number>,
      "factCount": <rendered.length>
    }
    ```
    Destination: the caller (route handler / MCP tool response).

**Side effects**: None. The module is a pure function – no database writes, no network calls, no event emissions, no mutable external state modified.

**Additional export `composeThaiAnswerWithLLM`**:
- Receives the same input shape.
- Delegates entirely to `composeThaiAnswer` (identical data flow).
- Returns the same output shape; currently no external LLM call or other side effects.
