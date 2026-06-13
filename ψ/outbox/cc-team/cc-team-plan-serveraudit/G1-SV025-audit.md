<!-- cc-team deliverable
 group: G1 (Server-node module audit)
 member: SV025 role=audit model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":2953,"completion_tokens":5000,"total_tokens":7953,"prompt_tokens_details":{"cached_tokens":2944,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4703,"image_tokens":0},"cache_creation_input_tokens":0} | 63s
 generated: 2026-06-13T11:31:00.575Z -->
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|--------------|
| **HIGH** | `execute` (nwpHourlyByLocationTool) lines constructing `fields` param | Passing an empty array for `fields` → `(input.fields \|\| [...])` sees empty array as truthy, `.join(",")` gives `""`, causing API request with `fields=` (empty string). This may return no data or an error silently. | Use `(input.fields?.length ? input.fields : [“tc”,“rh”,“cond”]).join(",")` to fall back to defaults. |
| **MEDIUM** | `getNwpApiKey()` live‑mode check | `key.includes("api12345")` matches any key containing that substring (e.g. `cat.api12345.prod`), blocking legitimate production keys. | Check exact equality against a list of known demo/lab keys, not substring. |
| **LOW** | `buildQueryParams` (and any inlined URLSearchParams constructs) | Optional string parameters (`domain`, `date`, `starttime`, etc.) that are empty strings are appended (`&domain=&date=`), which may cause the API to reject the request or behave unexpectedly. | Filter out empty strings before appending: `if (value !== undefined && value !== null && value !== '')`. |
| **LOW
