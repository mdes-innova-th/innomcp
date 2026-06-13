<!-- cc-team deliverable
 group: G1 (Server-node module audit)
 member: SV002 role=audit model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1529,"completion_tokens":3584,"total_tokens":5113,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3116,"image_tokens":0},"cache_creation_input_tokens":0} | 49s
 generated: 2026-06-13T11:19:54.642Z -->
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `flashSelector.select`, weather branch after province check | When weather keywords are present but no known province matches, the function returns a hardcoded `weather` tool call with `location: "Bangkok"`. This gives an incorrect answer for any unrecognized location (e.g., ���weather Phnom Penh”, “สภาพอากาศหาดใหญ่”) and silently misroutes the query. | Remove the generic fallback return; return `null` to let the LLM handle location extraction and avoid false weather answers. |
| HIGH | `flashSelector.select`, currency branch | Any currency-related query returns a fixed `currencyExchangeTool` call with `{ from: "USD", to: "THB", amount: 1 }`, ignoring the actual currencies and amount (e.g., “100 EUR to JPY”, “convert 50 dollars”). This always produces a wrong conversion, leading to misleading tool output. | Return a selection with empty `args` or `null`; override‑free so the LLM can parse amount and currencies. |
| LOW | `flashSelector.select`, province extraction | The matched province substring (e.g., “chiang mai”, “กรุงเทพ”) is passed directly as the `province` argument without normalisation. The downstream API `nwp_daily_by_place` may expect a specific canonical name (e.g., “Chiang Mai” capitalised, or an ID), causing look‑up failures. | Map the known-provinces list to the API’s expected format, or omit the `province` arg and let the LLM provide the canonical name. |
| LOW | `flashSelector.select`, entry | No runtime type guard on `query`; calling `query.toLowerCase()` if `query` is not a string (e.g., `undefined` in JavaScript) will throw and crash the MCP server. | Add a defensive check: `if (typeof query !== 'string') return null;` at the top of `select`. |

**Risk verdict:** High – hardcoded argument overrides in weather and currency branches cause silent mismatches and wrong answers for many realistic queries, undermining Flash Selector reliability.
