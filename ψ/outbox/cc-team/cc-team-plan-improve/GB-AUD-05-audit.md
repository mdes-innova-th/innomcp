<!-- cc-team deliverable
 group: GB (Bug/edge-case audit of critical chat-path modules)
 member: AUD-05 role=audit model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2856,"completion_tokens":3871,"total_tokens":6727,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3645,"image_tokens":0},"cache_creation_input_tokens":0} | 53s
 generated: 2026-06-13T11:12:36.827Z -->
| severity | location                           | issue                                                                                                                            | proposed fix                                                                                                   |
|----------|------------------------------------|----------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| HIGH     | `planToolCall`, lines ~146, ~164   | `extractThaiProvince` is invoked but neither imported nor defined in the module, causing a `ReferenceError` at runtime.          | Import or declare `extractThaiProvince` (e.g., from a geo utility) before it is used.                           |
| MEDIUM   | `extractMathExpression` / line ~56 | When the query contains no recognisable math (e.g., “calculate” alone), the function returns the original query string (“calculate”) as the tool argument, which will be silently rejected by the calculator tool. | Guard with a check – if safe expression is empty or has no digit, return a clear error plan or fallback sentinel. |

**Risk verdict:** HIGH – missing `extractThaiProvince` causes a definite runtime crash; MEDIUM – calculator tool may receive non‑evaluable expressions resulting in silent tool failures.
