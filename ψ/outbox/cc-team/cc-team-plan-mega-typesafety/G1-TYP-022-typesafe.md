<!-- cc-team deliverable
 group: G1 (typesafety division)
 member: TYP-022 role=typesafe model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":2265,"completion_tokens":2157,"total_tokens":4422,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1923,"image_tokens":0},"cache_creation_input_tokens":0} | 41s
 generated: 2026-06-13T12:02:36.454Z -->
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| High | `Counter.exportLines`, `Gauge.exportLines`, `Histogram.exportLines` | `JSON.parse(key) as string[]` (Unsafe JSON.parse & unsafe cast) | Wrap `JSON.parse` in `try/catch`. Validate the result using `Array.isArray(parsed) && parsed.every(v => typeof v === 'string')` instead of using `as string[]`. |
| Medium | `Metric.getOrCreate` | `this.labelMap.get(k)!` (Non-null assertion) | Store the result of `createFn()` in a local variable, call `this.labelMap.set(k, val)`, and return the local variable to avoid the `!` assertion. |
| Medium | `MetricsCollector.metrics` | `Metric<any>` (Explicit `any` type) | Replace `any` with `unknown` or a specific union type (e.g., `Metric<number \| { buckets: number[]; count: number; sum: number; bucketCounts: number[] }>`). |
