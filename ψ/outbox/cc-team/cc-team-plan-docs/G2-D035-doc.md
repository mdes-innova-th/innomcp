<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D035 role=doc model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1579,"completion_tokens":558,"total_tokens":2137,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 11s
 generated: 2026-06-13T11:25:09.489Z -->
- **`GeoAggregator` (class)** — Aggregates raw weather data into a compact `WeatherPacket`. Exposes `format` and `merge` for post-processing GeoGuard tool output.

- **`GeoAggregator.format(packet)`** — Fills in `summary`, `temp`, and `humidity` on a raw `WeatherPacket` by extracting values from `raw_data` across multiple common key shapes. `@param packet` — raw packet from GeoGuard. `@returns` the same packet with derived fields added; returns the input unchanged if `error` is set or `raw_data` is missing. Caveat: scans keys top-level and one level into `data[0]`; numeric strings are coerced.

- **`GeoAggregator.merge(packets)`** — Combines multiple `WeatherPacket`s (e.g., primary + fallback) into one. `@param packets` — list of packets. `@returns` the first packet with non-error/non-empty data; if all errored, returns the first input; if none provided, returns an empty sentinel packet. Caveat: when multiple valid packets exist, currently just returns the first one — the "merge" step does not actually combine evidence fields.

- **`GeoAggregator#findNumber(data, keys)`** *(private)* — Looks up the first numeric value in `data` (or `data[0]`) matching any of the given keys, accepting both `number` and numeric `string`. `@returns` the number, or `undefined`.

- **`GeoAggregator#findString(data, keys)`** *(private)* — Looks up the first non-empty trimmed string in `data` (or `data[0]`) matching any of the given keys. `@returns` the string, or `undefined`.

- **`GeoAggregator#buildSummary(data, temp, humidity, source)`** *(private)* — Builds a Thai-language human-readable summary string from available fields, appending `(source)` at the end. Falls back to `"ดึงข้อมูลสำเร็จ"` when no parts are available.

- **`GeoAggregator#normalizeConditionThai(input)`** *(private)* — Maps common English weather condition strings to Thai labels via regex (clear/sunny → "ท้องฟ้าโปร่ง", rain → "ฝนตก", etc.). Returns the trimmed input unchanged when no rule matches.

- **`GeoAggregator#emptyPacket()`** *(private)* — Returns a `WeatherPacket` sentinel with `source: "none"`, `confidence: 0`, and the Thai summary `"ไม่พบข้อมูลสภาพอากาศ"`, timestamped to now.
