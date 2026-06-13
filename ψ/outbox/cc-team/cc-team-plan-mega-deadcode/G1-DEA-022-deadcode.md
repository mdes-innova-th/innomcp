<!-- cc-team deliverable
 group: G1 (deadcode division)
 member: DEA-022 role=deadcode model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":2255,"completion_tokens":5709,"total_tokens":7964,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5383,"image_tokens":0},"cache_creation_input_tokens":0} | 105s
 generated: 2026-06-13T12:04:40.119Z -->
| location | what | why-safe-to-remove |
| :--- | :--- | :--- |
| `Histogram` class (type definition & `observe` method) | `buckets` property in the metric data object and its initialization (`buckets: [...this.buckets]`) | The property is allocated but never read. `exportLines` and other methods reference `this.buckets` from the class instance, making the per-label copy dead code. |
| `Counter.inc` and `Gauge.inc` methods | Redundant `const k = this.key(labels);` computation | `this.key(labels)` is already computed internally by `this.getOrCreate(labels, ...)` on the preceding line. The duplicate call can be removed by refactoring `getOrCreate` to return the key or by inlining the map lookup. |
| `formatLabels` function | `.filter(([, v]) => v !== undefined)` condition | `LabelValues` is strictly typed as `Record<string, string>`, meaning values are guaranteed to be strings. The undefined check is always true and type-redundant. |
| `Counter`, `Gauge`, and `Histogram` `exportLines` methods | Duplicated logic for reconstructing `labelObj` from `JSON.parse(key)` | The exact same 4-line block parsing the map key back into a `LabelValues` object is copy-pasted in all three subclasses. It can be safely extracted into a shared protected helper method (e.g., `parseKey`) in the base `Metric` class. |
