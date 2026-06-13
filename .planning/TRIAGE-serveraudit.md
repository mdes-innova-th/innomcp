_43 findings consolidated, 2 missing._

# TRIAGE — serveraudit

> Bug/edge-case audit of innomcp-server-node untested modules (provider=0).

> Generated for mother-Sonnet review. provider=0 deliverables.


---

## SV001 — audit — `innomcp-server-node/src/intelligence/fastPathLayer.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `process` method, Thai history block: `if (q.includes(key))` inside `for...of` loop over

---

## SV002 — audit — `innomcp-server-node/src/intelligence/flashSelector.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `flashSelector.select`, weather branch after province check | When weather keywords are present but no known province matches, the function returns a hardcoded `weather` tool call with `location: "Bangkok"`. This gives an incorrect answer for any unrecognized location (e.g., ���weather Phnom Penh”, “สภาพอากาศหาดใหญ่”) and silently misroutes the query. | Remove the generic fallback return; return `null` to let the LLM handle location extraction and avoid false weather answers. |
| HIGH | `flashSelector.select`, currency branch | Any currency-related query returns a fixed `currencyExchangeTool` call with `{ from: "USD", to: "THB", amount: 1 }`, ignoring the actual currencies and amount (e.g., “100 EUR to JPY”, “convert 50 dollars”). This always produces a wrong conversion, leading to misleading tool output. | Return a selection with empty `args` or `null`; override‑free so the LLM can parse amount and currencies. |
| LOW | `flashSelector.select`, province extraction | The matched province substring (e.g., “chiang mai”, “กรุงเทพ”) is passed directly as the `province` argument without normalisation. The downstream API `nwp_daily_by_place` may expect a specific canonical name (e.g., “Chiang Mai” capitalised, or an ID), causing look‑up failures. | Map the known-provinces list to the API’s expected format, or omit the `province` arg and let the LLM provide the canonical name. |
| LOW | `flashSelector.select`, entry | No runtime type guard on `query`; calling `query.toLowerCase()` if `query` is not a string (e.g., `undefined` in JavaScript) will throw and crash the MCP server. | Add a defensive check: `if (typeof query !== 'string') return null;` at the top of `select`. |

**Risk verdict:** High – hardcoded argument overrides in weather and currency branches cause silent mismatches and wrong answers for many realistic queries, undermining Flash Selector reliability.

---

## SV003 — audit — `innomcp-server-node/src/intelligence/pipeline.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | constructor: `this.vectorStore.load().catch(...)` | Race condition: `load()` is fire-and-forget; memory searches may execute before store data is loaded, causing silent empty results or errors. | Await `load()` in an async initialisation method or gate searches on a ready flag; alternatively, call `load()` in `startMemoryLookup` before searching. |
| MEDIUM | `execute()` high‑confidence branch after `if (tool && (tool.confidence ?? 0) >= 0.8)` | Yields two `"final_answer"` events (first with selected tool info, second with "Tool Executed Successfully"), violating the expected single terminal answer and causing clients to disconnect before receiving the tool result. | Replace the first `"final_answer"` with a `"selection"` or `"progress"` event; emit the actual `"final_answer"` only after tool execution completes, containing the result if applicable. |
| MEDIUM | Same branch: `if (tool.toolName)` guard after first `final_answer` | If `tool.toolName` is empty/null, a `final_answer` with an empty name is still yielded and no tool runs, leading to a misleading success message. | Check `tool.toolName` before yielding the first final answer; if empty, treat as low‑confidence and skip tool branch entirely. |
| MEDIUM | `startMemoryLookup()` catch block | All errors in embedding/vector store are silently swallowed; no error event is emitted to the consumer, hiding infrastructure failures (e.g., embedding service down). | Emit an `"error"` event via the generator before returning `[]` to inform the client of the failure, while still preventing a crash. |

Risk verdict: Race on unloaded store silently breaks memory lookups, and premature final answers make tool results invisible to clients.

---

## SV004 — audit — `innomcp-server-node/src/mcp/config/nwpApiConfig.ts` [deepseek/deepseek-v4-pro]
| Severity | Location                                              | Issue                                                                     | Proposed Fix                                                                                                  |
|----------|-------------------------------------------------------|---------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| HIGH     | `getProvinceCoords` function, after `name.trim()`     | Blank/whitespace-only input (e.g. `"   "`) is not caught after trimming; `normalized` becomes `""`, which makes `k.toLowerCase().includes("")` true for all entries, returning the province with the shortest key (e.g., "กทม" → Bangkok) silently. | Add an early return after trimming: `const normalized = name.trim().toLowerCase(); if (!normalized) return undefined;` (before existing `if (!name)`). |
| MED      | `getProvinceCoords` function, partial match fallback  | Ambiguous partial match (e.g. "ชัย") returns arbitrary province (ชัยนาท) because sorting by shortest key does not guarantee the intended location; no indication of multiple matches.                 | When multiple partial matches exist, return `undefined` (or log a warning) to avoid silent incorrect results. Optionally, use exact substring match with strict criteria. |

**1-line risk verdict:** Silent return of wrong coordinates for blank input and unresolved ambiguities can feed invalid locations to downstream APIs, leading to incorrect weather data and potential decision errors.

---

## SV005 — audit — `innomcp-server-node/src/mcp/knowledge/types/history.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| MEDIUM   | `HistoryToolSuccess.data[].aliases` vs `ThaiHistoryEntityTyped.aliases` | `aliases` is required (`string[]`) in the tool success response type, but optional (`aliases?: string[]`) in the typed entity schema. Any code that maps an entity to the response will fail TypeScript compilation when `aliases` is `undefined`. | Align the contracts: either make `aliases` optional in `HistoryToolSuccess` (preferred, since the source entity may genuinely have no aliases) or make it required with a default empty array in `ThaiHistoryEntityTyped`. |

Risk verdict: Low operational risk – types file only; single optionality mismatch may cause compile-time friction but no runtime failures, races, or missing error handling.

---

## SV006 — audit — `innomcp-server-node/src/mcp/knowledge/types/law.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
| --- | --- | --- | --- |
| HIGH | `sections: z.array(z.custom<LawSection>()).optional()` | `z.custom` without a validation function silently accepts any value, breaking runtime type safety for `LawSection` arrays. Malformed data will not be rejected, leading to downstream crashes. | Define a proper Zod schema for `LawSection` (e.g., `z.object({ no: z.string(), title: z.string().optional(), content: z.string(), keywords: z.array(z.string()).optional() })`) and use `z.array(LawSectionSchema).optional()`. |
| MEDIUM | `published_date: z.string().optional()` | No format validation for `YYYY-MM-DD`; any string is accepted, risking invalid dates that can break consumers expecting valid dates. | Use `z.string().regex(/^\d{4}-(0[1-9]\|1[0-2])-(0[1-9]\|[12]\d\|3[01])$/).optional()` or `z.string().date().optional()` (with `z.date()` or refinement). |
| LOW | `last_updated: z.string()` | Required but no timestamp format enforcement; unvalidated strings can cause parsing failures in logic that expects ISO-8601. | Change to `z.string().datetime()` or add a refinement with `z.string().refine(...)` to enforce ISO-8601. |

**Risk Verdict:** A critical runtime validation bypass in `sections` silently corrupts entity data; missing date validations further risk data integrity and downstream failures.

---

## SV007 — audit — `innomcp-server-node/src/mcp/knowledge/types/religion.ts` [deepseek/deepseek-v4-pro]
| severity | location | issue | proposed fix |
|----------|----------|-------|--------------|
| HIGH | `ThaiReligionEntitySchema` attributes `location: z.custom<GeoLocation>().optional()` | `z.custom<GeoLocation>()` without a validation function provides zero runtime checks; any value passes, leading to silent acceptance of malformed location data, causing downstream type-safety breaks and potential crashes. | Define a proper Zod object schema for `GeoLocation` (e.g., `z.object({ lat: z.number(), lon: z.number(), province: z.string(), district: z.string().optional() })`) and use it instead of `z.custom`. |
| MEDIUM | `ThaiReligionToolInputSchema` `query: z.string()` | Missing `.min(1)` allows empty string to be passed as query, which may cause silent operation failures or meaningless results. | Change to `z.string().min(1, "Query cannot be empty")`. |

**Risk verdict:** HIGH—unvalidated custom type lets arbitrary data masquerade as a `GeoLocation`, risking runtime crashes and data corruption.

---

## SV008 — audit — `innomcp-server-node/src/mcp/tmdApiConfig.ts` [deepseek/deepseek-v4-pro]
| severity | location | issue | proposed fix |
|----------|----------|-------|---------------|
| MEDIUM | `getTmdCredsForTier` (line ~48) | Per-field fallback can mix tier-specific uid/ukey with deprecated shared credentials (e.g., `TMD_UID_API` set but `TMD_UKEY_API` missing ⇒ uid from API tier, ukey from `TMD_UKEY`). This silently assembles an inconsistent credential pair, leading to hard-to-diagnose auth failures. | Apply fallback as a whole pair: after reading tier-specific env, if *either* uid or ukey is still empty, overwrite **both** with the deprecated `TMD_UID`/`TMD_UKEY` pair (or throw an error that the pair is incomplete). |

**Risk verdict:** Credential mixing can cause silent auth failures; other logic is safe.

---

## SV009 — audit — `innomcp-server-node/src/mcp/tools/archiveTool.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `searchArchive` – lines 82, 93, 107 (logBoth calls) | `logBoth` is called without `await`; if it returns a Promise that rejects, the unhandled rejection may crash the Node.js process. | `await logBoth(...)` each call or add `.catch(() => {})` to safely swallow errors. |
| MEDIUM | `searchArchive` – `fetch(url.toString(), …)` | No timeout is set, allowing the fetch to hang indefinitely (e.g., network stall). This can block the MCP tool forever and leak resources. | Use `AbortSignal.timeout(10_000)` (or `AbortController` + `setTimeout`) to abort after a sensible timeout. |
| LOW | `searchArchive` – result mapping, `format: doc.format` | The code assumes `doc.format` is always an array; the API may return a scalar string. When it’s a string, `Array.isArray` is false and format data is silently omitted. | Normalize `doc.format` into an array (`Array.isArray(doc.format) ? doc.format : [doc.format]`) before assignment. |

**Risk Verdict:** Unhandled promise rejections from unawaited `logBoth` can crash the server; missing fetch timeout may cause indefinite hangs.

---

## SV010 — audit — `innomcp-server-node/src/mcp/tools/audioTranscribeTool.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `loadAudioBytes`: `fs.readFile(input.audioPath)` — no size check before read | Entire file is read into memory before checking `MAX_BYTES`, enabling memory exhaustion / DoS with a large allowed-extension file. | Use `fs.stat` to check file size and reject immediately if > `MAX_BYTES` before calling `readFile`. |
| HIGH | `loadAudioBytes`: `Buffer.from(payload, "base64")` — no size estimate before decode | Decodes the whole base64 string into memory before checking decoded size, allowing memory exhaustion / DoS with a huge payload. | Estimate decoded length (e.g., `(payload.length * 3)/4 - padding`) and reject early if estimate exceeds `MAX_BYTES`. |
| HIGH | `transcribeViaOpenAI` / `transcribeViaGateway`: `fetch(...)` without timeout | Network requests can hang indefinitely on unresponsive backends, blocking the MCP server with no abort mechanism. | Create `AbortController` with a sensible timeout (e.g., 120s) and pass `signal` to `fetch`. |
| HIGH | `loadAudioBytes`: `fs.readFile(input.audioPath)` allows path traversal | Attacker‑controlled `audioPath` can read any file with an allowed extension (e.g., `../../secret.mp3`) — no workspace root confinement. | Resolve `audioPath` against a configurable `WORKSPACE_ROOT`, then verify the resolved path stays inside that root using `path.resolve` + `startsWith` or `fs.realpath`. |
| MEDIUM | `execute`: relative `audioPath` resolves against `process.cwd()` | The tool describes workspace‑relative paths, but no workspace root is provided; relative paths may fail or read wrong files if cwd differs from intended workspace. | Accept a workspace root from environment or config, resolve relative paths against it, and reject paths that escape. |
| LOW | `transcribeViaGateway`: fallback `data.text \|\| data.transcription \|\| ""` | If the gateway returns neither field, the tool silently returns an empty transcription, hiding a backend data contract violation and possibly misleading callers. | Validate that at least one field contains a non‑empty string; throw an error with details if both are missing. |

**Risk verdict:** Multiple critical defects — path traversal, unbounded memory DoS via file/b64, and fetch hang — create exploitable vulnerabilities in a production tool.

---

## SV012 — audit — `innomcp-server-node/src/mcp/tools/dataAnalysisTool.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH     | `execute()` final `return JSON.stringify(...)` | `JSON.stringify(result)` can throw (e.g., BigInt, cyclic objects) not caught by try‑catch, causing unhandled promise rejection and server error. | Wrap the `JSON.stringify` call in a try‑catch block; on error return `JSON.stringify({ ok: false, error: "Result serialization failed" })`. |
| MED      | `parseRows()` – CSV path | `parseCsv` parses the entire input without row limit; large CSV files can exhaust memory before the `MAX_ROWS` slice is applied. | Pass `to: MAX_ROWS` (or `max_records: MAX_ROWS`) to `parseCsv` options to stop parsing early. |
| LOW      | `execute()` – `allRows` filtering | If `rows[0]` is a non‑object (e.g., array of primitives), `Object.keys(rows[0] ?? {})` gives empty headers silently; downstream still runs and returns a “valid” but empty result, hiding bad input. | After parsing, validate each row is a plain object; return an error if any row is not an object. |

**Risk Verdict**: Unhandled serialisation error leads to undelivered server responses under normal tool usage; missing input size guard enables trivial memory exhaustion attacks.

---

## SV013 — audit — `innomcp-server-node/src/mcp/tools/dateTimeTool.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|--------------|
| HIGH | `registerDateTimeTool`: `inputSchema` assignment | Schema passed as a plain object `{format: z.string().optional()}` instead of `z.object({…})`. The SDK receives a non‑Zod schema, breaking input validation and potential JSON‑schema generation. | Replace with `z.object({ format: z.string().optional().describe(...) })` and remove the `as any` cast. |
| HIGH | Thai format case inside handler | Uses `now.toLocaleDateString('th-TH', {...})` which ignores the time options (`hour`, `minute`, `second`) and returns only the date. The advertised example includes time, so the core “current time” feature is broken. | Change to `now.toLocaleString('th-TH', { ... })` so both date and time are included. |
| MEDIUM | Handler logic | No validation that `format` is one of the allowed values (`thai`, `iso`, `timestamp`). The description states an expected `400` for invalid format, but the code silently falls back to the JavaScript default string, violating the contract. | Add an enum check (e.g., with Zod or a manual guard) and, if invalid, return an error content with appropriate status. |

**1‑line risk verdict:** Broken input schema and missing time in Thai output silently deliver incorrect results under the tool's advertised contract.

---

## SV014 — audit — `innomcp-server-node/src/mcp/tools/docWriterTool.ts` [deepseek/deepseek-v4-pro]
| severity | location | issue | proposed fix |
|----------|----------|-------|---------------|
| HIGH | Top-level `(async () => { try { await fs.mkdir(...) } catch {} })();` | Race condition: directory creation is fire-and-forget; the directory may not exist when the tool writes a file, causing `ENOTDIR`/`ENOENT` errors. | Use top-level `await` to ensure directory exists before accepting tool calls, or move directory creation into the handler with proper error handling. |
| HIGH | `buildDocx` – ordered list handling (paragraph with `numbering: { reference: "ordered" }`) | Missing numbering definition in the `Document`. The `docx` library requires a numbering part; `Packer.toBuffer` will fail with a "missing numbering part" error for any document containing an ordered list. | Add a `numbering` config to the `Document` options (e.g., define a numbering config with reference `"ordered"`). |
| MEDIUM | Top-level directory creation IIFE | Silent failure: `catch {}` swallows errors; if directory creation fails (permission, disk), the tool will later fail with obscure write errors without any diagnostics. | Log/throw the error or at least emit a warning so the failure is observable. |
| MEDIUM | `buildDocx` – table block (`new Table({ rows, ... })`) | An empty `rows` array (valid per schema) may cause a runtime error from the `docx` library if it requires at least one row. | Guard against empty rows: either validate `min(1)` in the schema or skip table generation when rows is empty. |

**Risk verdict:** The module contains two HIGH‑severity defects (DOCX ordered lists always fail, race‑condition on storage directory) that make the tool unreliable; silent error swallowing and a potential DOCX table crash further degrade observability.

---

## SV015 — audit — `innomcp-server-node/src/mcp/tools/echartsTool.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `inputSchema` definition (line ~34) | Plain object passed as Zod schema; `registerTool` cast as `any` hides invalid type. MCP server may reject the tool or skip validation entirely. | Use `z.object({ type: z.string().optional(), ... })` and remove `as any`. |
| HIGH | Handler after `type` default (line ~46) | Only checks falsy/`'undefined'` but never validates `type` against allowed values (`bar`,`line`,`pie`,…). Invalid types (e.g. `'histogram'`) pass silently, causing broken chart options. | Validate `type` with an enum check; if invalid, throw or fallback to a safe default with a warning. |
| MEDIUM | `chatText` parsing (lines ~78-97) | Assumes whitespace-separated label-value pairs; fails on formats like `"Bangkok:40%"` or `"Bangkok 40 %"` producing `NaN` data values or incorrect labels. No validation that `parseFloat` returns finite numbers. | Use regex to capture non-numeric label and numeric value (strip non-numeric suffixes), and validate each parsed number with `isNaN` before use; throw on failure. |
| MEDIUM | Option builder for non-pie charts (line ~106) | No check that `finalLabels.length` equals each `dataset.data.length`. Mismatch leads to misaligned axes or unknown rendering behavior. | Add assertion or pad/trim arrays to align lengths; at minimum log a warning. |
| LOW | Top of file | `import * as echarts from "echarts"` is unused. Increases bundle size without purpose. | Remove the import. |
| LOW | Fallback condition (line ~113) | Only triggers when `finalLabels` or `finalDatasets` is falsy; empty arrays (truthy) bypass the fallback, leading to empty charts with no data. | Extend condition: `if (!finalLabels?.length || !finalDatasets?.length)` to handle empty arrays. |

**Risk verdict:** HIGH — invalid input schema and missing type validation risk tool rejection or silent garbage-in, garbage-out chart generation.

---

## SV016 — audit — `innomcp-server-node/src/mcp/tools/evidenceTool.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| MEDIUM | `callDetectAPI()` | `AbortController` timeout throws `AbortError` which is caught only by the outer generic catch in `execute()`. Users see a hardcoded Thai apology without any indication that the request timed out, making the failure untraceable. | Wrap the `fetch` in a `try…catch` that re-throws a descriptive error like `"Request timed out after X ms"` when the cause is `AbortError`, so the error message in `mcpError` can include a timeout hint. |

**Risk verdict:** Low risk — no crashes, but timeout errors are silently masked, potentially causing confusing user feedback.

---

## SV017 — audit — `innomcp-server-node/src/mcp/tools/fileReaderTool.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `execute`, auto-detect + description | Schema/description states `filePath` can be "Path หรือ base64", but implementation never decodes base64. Passing base64 causes `ENOENT` or misleading "ไม่รองรับไฟล์ชนิด" errors. | Remove base64 claim from description, or implement base64 detection and convert to `Buffer` before passing to readers (all libraries accept Buffer). |
| MEDIUM | `readPDF` `options.maxPages` | `options.maxPages || undefined` replaces `0` with `undefined`, ignoring an explicit request to read zero pages (should honour 0 or reject it). | Use `options.maxPages ?? undefined` or `options.maxPages != null ? options.maxPages : undefined`. |
| LOW | `readExcel`, empty workbook | `workbook.SheetNames[0]` can be `undefined` when there are no sheets, leading to `sheetName = undefined` and confusing error message `'ไม่พบ sheet \'undefined\''`. | Before accessing, check `workbook.SheetNames.length === 0` and throw a clear error like "Workbook contains no sheets". |

**Risk verdict:** HIGH risk: base64 file input is advertised but fails entirely; `maxPages` silently ignores `0`; empty Excel workbook gives cryptic undefined-sheet error.

---

## SV018 — audit — `innomcp-server-node/src/mcp/tools/govDataTool.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| MEDIUM | `searchGovData` function (line ~48) | `fetch` has no timeout; network hang can block the tool indefinitely, leading to resource exhaustion. | Create an `AbortController`, set a `setTimeout` to abort after a reasonable duration (e.g., 30s), and pass `signal` to `fetch`. Gracefully handle the `AbortError` in the catch block. |
| MEDIUM | `searchGovData` return statements (lines ~68, ~82) | Inconsistent output format: returns a JSON object when no datasets found, but returns formatted plain text when datasets exist. This breaks any consumer expecting a uniform response schema. | Unify the return format—either always return structured JSON (preferred for automation) or always plain text. E.g., for the “found” case, return a JSON string containing `success`, `query`, `totalFound`, `results`, and `formattedText`. |
| LOW | `formatGovData` (line ~105) | `stripHtml(notes)` is called twice per dataset (slice and length check), wasting CPU and risking different results if the string is mutated between calls (unlikely but avoidable). | Store the result of `stripHtml(notes)` in a local variable and reuse it for the slice and length check. |
| LOW | `catalogBaseUrl` / `searchGovData` (line ~42) | If `DATAGOV_CATALOG_BASE_URL` is set to a value lacking a protocol (e.g., `catalog.data.gov`), `new URL` will throw and the error reaches the catch block with a potentially cryptic message. | Validate the base URL format at startup or inside `catalogBaseUrl` (ensure it starts with `http://` or `https://`), or provide a user-friendly error in the catch handler. |

**Risk Verdict:** Hang risk from missing fetch timeout + inconsistent output format can silently break integrations; add timeout and unify response structure.

---

## SV019 — audit — `innomcp-server-node/src/mcp/tools/imageGeneratorTool.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `drawChart()` function end (truncated) | The function body is incomplete (ends with `ctx.fillText(ch` and truncation), causing a syntax/runtime error whenever a chart is requested. | Complete the chart drawing logic; ensure the function is fully implemented and closed. |
| HIGH | `execute` → `createCanvas(width, height)` | No upper bound on `width`/`height`; an attacker (or user) can request e.g. 1000000×1000000, exhausting memory and crashing the process. | Add `z.number().int().min(1).max(...)` constraints on width/height in the schema (e.g. max 8000). |
| MEDIUM | `execute`, after `switch(type)` block | When `type` is `"shape"` or `"text"`, the respective content is drawn inside the switch **and again unconditionally** afterwards, causing duplicate rendering (e.g. shapes drawn twice, text overlaid twice). | Remove the `drawShapes`/`drawText` calls from the `"shape"` and `"text"` cases so they are drawn only once by the final unconditional block. |
| MEDIUM | `drawShapes`, `drawChart` | Negative/zero values for dimensions/radius are accepted (schema uses `z.number()` without `.positive()`), leading to invisible or broken shapes/charts, or to `createCanvas` throwing a confusing error. | Add `.positive()` (and `.int()` where appropriate) to shape coordinates, widths, heights, and radius in the content validation. |
| LOW | `drawShapes`, `drawText`, background fill | Invalid CSS color strings (e.g. hex without `#`, misspelled name) are set directly to `fillStyle`/`strokeStyle`; the canvas silently ignores them, leaving previous/default color. | Validate `color` fields with a regex or a Zod refinement and reject/graylist invalid colors before drawing. |

**Risk verdict:** Critical: chart feature is non‑functional (crash) and missing size limits enable denial‑of‑service; duplicate drawing corrupts output for shape/text modes.

---

## SV020 — audit — `innomcp-server-node/src/mcp/tools/keywordTool.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `execute` catch block (line ~44) | Error responses omit `isError: true`. The MCP client cannot distinguish between success and failure, leading to silent failures. | Add `isError: true` to the returned object in the catch block: `return { content: [...], isError: true };` |
| LOW | `execute` catch block (line ~44) | If the caught error is not an `Error` instance, `err.message` is `undefined`, yielding a meaningless "Error: undefined" message. | Use `err?.message ?? 'Unknown error'` to provide a fallback. |

Risk: High – Silent error swallowing fools callers into treating failures as successful results.

---

## SV021 — audit — `innomcp-server-node/src/mcp/tools/mcpSchema.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `createObjectSchema` & `prop.*` builders | All builders embed the `optional` flag directly in the returned property objects; `createObjectSchema` passes them into the output schema without removal. This leaks a non-standard field into the MCP schema, potentially causing validation failures in strict consumers, and also creates a shared-reference risk (caller can mutate the schema). | Deep-clean properties inside `createObjectSchema`: recursively strip the `optional` field from each property and its nested `items`/`properties`, creating new plain objects to avoid mutation. |
| MED | `createObjectSchema` parameter `properties` | No runtime guard: calling `createObjectSchema(null)` or with a non-object argument throws an unhandled `TypeError` from `Object.entries`. | Add an early check: `if (typeof properties !== 'object' || properties === null) throw new TypeError('properties must be an object');` |
| LOW | `prop.array` / `prop.object` parameter order | The `optional` parameter comes after `description`, making it easy to misplace arguments when calling from JavaScript (e.g., `prop.array(items, true)` stores `true` as `description`). TypeScript callers are protected, but JavaScript

---

## SV022 — audit — `innomcp-server-node/src/mcp/tools/nasaTool.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `fetchAPOD` function (line ~80) | `fetch()` has no timeout/AbortController; request can hang indefinitely, causing resource leak and tool unresponsiveness. | Add `AbortSignal.timeout(10_000)` to `fetch(url.toString(), { signal: AbortSignal.timeout(10000) })` (or configurable) to reject after a deadline. |
| MEDIUM | `fetchAPOD` → "today"/"now"/"วันนี้" handling (line ~90) | Uses `new Date().toISOString().split('T')[0]` which returns UTC date. NASA APOD may use a different day boundary (e.g., EST), leading to a mismatch when user's local date differs from UTC date. | Compute date in a fixed timezone (e.g., America/New_York) using `Intl.DateTimeFormat` or document that "today" is UTC-based. |
| LOW | Input validation in `fetchAPOD` (line ~100) | Regex `/^\d{4}-\d{2}-\d{2}$/` does not validate actual calendar date (e.g., "2024-02-30" passes). Invalid date sent to NASA API will return error, but silently fails with generic error after full fetch attempt. | Add date validation (e.g., `new Date(dateStr).toISOString().startsWith(dateStr)` and check `!isNaN(...)`) before calling API to give early clear error. |
| LOW | `formatSingleAPOD` (line ~180) | If `media_type` is neither "image" nor "video", the "🔗 Image URL:" line prints no following content, producing a misleading placeholder. | Add an `else` branch to log unknown type or handle gracefully. |

**Risk verdict:** HIGH – Missing fetch timeout can cause indefinite hanging and resource leak; UTC "today" logic may silently return wrong APOD.

---

## SV023 — audit — `innomcp-server-node/src/mcp/tools/newtonTool.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `newtonTool.ts` lines where `tangent` and `area` operations are handled, and `performSymbolicMath` constructs the URL | The `tangent` and `area` operations require additional parameters (point/range) that are not collected from input; the API call will always fail for these operations, rendering them unusable with a cryptic error. | Extend the Zod schema to conditionally require `point` (for tangent) and `start`/`end` (for area). Build the URL accordingly: `/tangent/:expr/:point` and `/area/:expr/:start/:end`. |
| HIGH | `performSymbolicMath` – `fetch(url, …)` | No timeout is set on the HTTP fetch; the request can hang indefinitely, consuming resources and blocking the MCP tool response forever. | Use `AbortController` with `setTimeout` (e.g., 10 s) to abort the fetch and throw an error if the API does not respond in time. |
| MEDIUM | `performSymbolicMath` catch block | On a failed `response.json()` (e.g., malformed JSON from API), the caught error message is generic and may obscure the real cause. | Specific check: read `response.text()` on non-2xx/non-JSON and include raw body in the error message. |

**Risk Verdict:** Unusable `tangent`/`area` operations and missing fetch timeout risk server resource hang – both HIGH severity.

---

## SV024 — audit — `innomcp-server-node/src/mcp/tools/nwpDailyTool.ts` [deepseek/deepseek-v4-pro]
| severity | location | issue | proposed fix |
|----------|----------|-------|---------------|
| HIGH | `nwpDailyByLocationTool.execute` (lines after params construction) | The async `execute` function stops after building query parameters; it does **not** perform the actual API call and never returns a result. The tool will silently fail or return undefined, breaking the MCP contract. | Complete the function by adding the `axios` call with proper error handling, returning the expected content structure, and using the declared `DEFAULT_TIMEOUT`. |
| HIGH | Module scope | Schemas `nwpDailyByPlaceSchema` and `nwpDailyByRegionSchema` are exported, but the corresponding tool objects (`nwpDailyByPlaceTool`, `nwpDailyByRegionTool`) are missing. Any consumer that imports these tools will fail. | Implement the two missing tool objects with their own `execute` functions, or export only what is implemented. |
| MEDIUM | Top/`execute` | `DEFAULT_TIMEOUT` is defined but never used. Even when the function is completed, absent a timeout risks hanging requests indefinitely. | Apply `timeout: DEFAULT_TIMEOUT` in the `axios` request configuration. |

**Risk verdict:** Module is non-functional in its current state due to missing core logic; deploying it will cause silent failures and broken tool calls.

---

## SV025 — audit — `innomcp-server-node/src/mcp/tools/nwpHourlyTool.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|--------------|
| **HIGH** | `execute` (nwpHourlyByLocationTool) lines constructing `fields` param | Passing an empty array for `fields` → `(input.fields \|\| [...])` sees empty array as truthy, `.join(",")` gives `""`, causing API request with `fields=` (empty string). This may return no data or an error silently. | Use `(input.fields?.length ? input.fields : [“tc”,“rh”,“cond”]).join(",")` to fall back to defaults. |
| **MEDIUM** | `getNwpApiKey()` live‑mode check | `key.includes("api12345")` matches any key containing that substring (e.g. `cat.api12345.prod`), blocking legitimate production keys. | Check exact equality against a list of known demo/lab keys, not substring. |
| **LOW** | `buildQueryParams` (and any inlined URLSearchParams constructs) | Optional string parameters (`domain`, `date`, `starttime`, etc.) that are empty strings are appended (`&domain=&date=`), which may cause the API to reject the request or behave unexpectedly. | Filter out empty strings before appending: `if (value !== undefined && value !== null && value !== '')`. |
| **LOW

---

## SV026 — audit — `innomcp-server-node/src/mcp/tools/ocrTool.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| MEDIUM | `execute` try‑block after OCR | `fullText` is set to unfiltered `result.data.text.trim()`, while `words`, `lines`, and their counts are filtered by `confidence`. This produces a silent mismatch: `wordsCount` may be 0 while `text` contains many characters, confusing consumers who expect the text to reflect the confidence threshold. | Either filter `fullText` to only keep lines meeting the confidence threshold, or document clearly that `text` is raw and `words`/`lines` are filtered. |
| LOW | `ocrToolSchema` – `confidence` field | `confidence` accepts any number (no `.min(0).max(100)`). A value >100 silently yields zero words/lines (success but empty), and a negative value passes everything. Users may unintentionally provide out‑of‑range values with misleading results. | Add `z.number().optional().default(50).min(0).max(100)` to the Zod schema. |
| LOW | `Tesseract.recognize` logger callback | Direct call to `console.log` inside the logger callback. In environments where `console` is unavailable or its methods throw, the promise will reject, turning a non‑critical log failure into an OCR error caught by the outer try‑catch. | Wrap the callback body in a try‑catch or guard with `if (typeof console !== 'undefined') …` so that a log failure never breaks the OCR flow. |

**Risk Verdict:** Low – no crashes or data loss; only a silent data mismatch and minor

---

## SV027 — audit — `innomcp-server-node/src/mcp/tools/schemaWrapper.ts` [deepseek/deepseek-v4-pro]
| severity | location | issue | proposed fix |
|----------|----------|-------|---------------|
| MEDIUM | `wrapSchema` line `const wrapped = schema as any;` | Mutates the input schema by adding `typeName` directly to the original object. If the schema is shared across multiple tools, this can cause unexpected side effects (e.g., MCP SDK behaviour changes for other tools). | Clone the schema before modification, or return a new wrapper object that exposes the desired `typeName` without altering the original. |
| MEDIUM | `wrapped.typeName = wrapped._def.typeName \|\| "ZodObject"` | Fallback to `"ZodObject"` is incorrect for non‑object schemas (e.g., `ZodString`, `ZodNumber`) when `_def.typeName` is unexpectedly missing. This can cause MCP SDK to treat the schema as an object, leading to runtime validation errors or misleading tool definitions. | Remove the hardcoded fallback; either throw an error for unknown types or derive the type from the schema’s own introspection (e.g., `z.ZodFirstPartySchemaTypes` or a mapping) instead of assuming object. |
| LOW | function body | No null/undefined guard on `schema`; passing a falsy value (e.g., by unsafe cast) would throw `TypeError` at the `!wrapped.typeName` check. | Add a guard: `if (!schema) return schema;` (or throw a controlled error) at the start. |

**Risk verdict:** Mutation of shared schemas combined with an incorrect hardcoded type fallback introduces subtle, hard-to-diagnose runtime failures in multi-tool setups.

---

## SV029 — audit — `innomcp-server-node/src/mcp/tools/thaiGeoTool.types.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|--------------|
| N/A | entire file | No runtime code; only type declarations. No bugs, races, leaks, or async issues possible. | N/A |

**Risk Verdict:** No risk – module contains only TypeScript interfaces and types, no executable logic.

---

## SV030 — audit — `innomcp-server-node/src/mcp/tools/thaiHistoryTool.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `MariaDbHistoryDb.search` – catch block (lines ~60-65) | Original error swallowed without logging; fallback query not wrapped in try/catch, so if it fails the rejection propagates without context of the initial fault. | Log the original error before attempting fallback; wrap fallback query in a try/catch and throw a descriptive error if it also fails. |
| HIGH | `safeJsonParse` – early return when `typeof value === "object"` (line ~150) | Returns the original mutable object reference (e.g., arrays, attributes) instead of a copy, allowing cross-request mutation of shared in-memory data. | Deep-clone the value before returning, or use `structuredClone(value)` to prevent unintended mutation. |
| HIGH | `InMemoryHistoryDb` – constructor stores reference to input array; `search` returns entity objects directly (lines ~75, 90) | No cloning of stored entities or returned results; mutation by any consumer permanently corrupts the in-memory database. | Clone the entities array on construction and return cloned copies from search (or freeze/seal if immutability is intended). |
| MEDIUM | `MariaDbHistoryDb.search` – try block around both queries (lines ~55-65) | If LIKE query fails inside the try, the catch block re-executes the same LIKE query again, masking the real error and potentially creating confusing duplicate log entries. | Separate error handling: run fulltext and like queries with independent try/catch, or use a flag to avoid retrying the same fallback. |
| LOW | `MariaDbHistoryDb.search` – parameter `limit` (line ~45) | No validation that limit is a positive integer; zero or negative values could produce database errors or unintended infinite-like behavior (LIMIT 0). | Validate `limit` is an integer ≥ 1 and use a default if invalid. |

**Risk verdict:** High risk from silent error suppression and mutable reference sharing leading to undebuggable failures and data corruption across concurrent operations.

---

## SV031 — audit — `innomcp-server-node/src/mcp/tools/thaiKnowledge.types.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| LOW      | whole module | No runtime code; types/interfaces cannot cause bugs, races, or leaks directly. | N/A |

**Risk verdict:** No concrete defects in a type-only module; zero runtime risk.

---

## SV032 — audit — `innomcp-server-node/src/mcp/tools/thaiLawTool.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `execute()` – keyword search branch (else block) | `args.law_name_filter` is completely ignored when `type` is not `"section_lookup"`. Users applying a law name filter in search mode get unfiltered results without any indication. | Add a filter step before looping or inside the loop, mirroring the check used in the section_lookup path. |
| MEDIUM | `execute()` – DB fallback `catch` block | The `try/catch` around `dbQuery` silently drops all errors. Users receive a generic “ไม่พบข้อมูล” notice even when the database is unavailable, masking operational failures. | Log the error and return an error response indicating the database lookup failed, or re-throw after logging. |
| LOW | `execute()` – initial `query` assignment (`args.query.toLowerCase()`) | No guard against an empty `args.query`. An empty string leads to `"".includes("")` being true, causing the keyword search to match every law and return all sections, potentially flooding the output. | Add early return or validation: if not query.trim(), respond with a “query required” message. |

risk verdict: The tool silently discards user-supplied filters during keyword searches and swallows database errors, risking misleading outputs and hidden failures.

---

## SV033 — audit — `innomcp-server-node/src/mcp/tools/thaiReligionTool.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH   | `execute` async body (lines 43‑78) | No try‑catch; any synchronous throw (e.g., property access on undefined, logic error) becomes an unhandled promise rejection, risking server crash or silent failure. | Wrap the entire function body in `try { … } catch (err) {` and return an error content object with `type: "text"` and a descriptive error message. |
| MED    | `execute` filter/matching (line 62) | `item.name.includes(query)` is case‑sensitive while `alt_names` match uses `.toLowerCase()`. If a main name ever contains Latin characters, a differently‑cased query will be silently missed. | Change to `item.name.toLowerCase().includes(query)` for consistency. |
| MED    | `execute` query processing (line 47) | `const query = args.query.toLowerCase();` – if `args.query` is an empty string, every `includes("")` returns `true`, returning the entire knowledge base, which may be an unintended data exposure or performance issue. | Add an early guard: `if (!args.query || !args.query.trim())` return immediately with an empty‑result message. |

**Risk Verdict:** Missing error‑handling creates unhandled rejections under any runtime exception; combined with empty‑query data flood and case‑sensitivity inconsistency, the tool has a moderate risk of silent failures or unintended data disclosure.

---

## SV034 — audit — `innomcp-server-node/src/mcp/tools/tmdTools.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| MEDIUM | `withTmdAuthParams` | Throws `TypeError` for non-absolute or malformed `urlBase` (e.g., relative path) without a catch, crashing the tool call. | Validate `urlBase` with a try-catch and rethrow a descriptive error, or ensure callers never pass non-absolute URLs. |
| MEDIUM | `withTmdAuthParams` | Appends uid/ukey without removing any existing credentials leading to duplicate auth parameters, which may cause unpredictable API behavior or ambiguous credential use. | Check and delete `uid`/`ukey` from existing search params before adding new ones, to enforce a single source of truth. |
| MEDIUM | `fetchWithTimeout` | Relies on global `fetch` without a polyfill check; if the Node runtime does not provide it (pre‑v18 or without `--experimental-fetch`), the module silently fails at runtime. | Add a guard that verifies `typeof fetch === 'function'` at import time and throws a clear “fetch unavailable” error, or document the required Node version. |

**Risk Verdict:** Tools break on malformed URLs and duplicate auth, with a potential runtime crash on fetch‑unaware Node – overall robustness is compromised.

---

## SV035 — audit — `innomcp-server-node/src/mcp/tools/weatherTool.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | Implicit tool handler (no handler exported) | No handler exported for `type: "hourly"`; schema allows it but no `fetchHourly` exists. Calling with `type="hourly"` will cause silent failure or unhandled error. | Implement `fetchHourlyForecast` function and wire up a dispatcher based on `type`; export the dispatcher as the tool handler. |
| HIGH | Module scope | Zero `export` statements – `fetchCurrentWeather`, `fetchForecast`, etc. are not exported. MCP server registration will fail because these functions are inaccessible. | Add `export` keyword to all functions that are intended for external use. |
| MEDIUM | `fetchCurrentWeather` / `fetchForecast` | `fetch()` called without timeout. A network stall or unresponsive API causes the tool to hang indefinitely, potentially blocking the MCP server. | Pass an `AbortController` with a sensible timeout (e.g. 10 s) to `fetch`. |
| LOW | `formatCurrentWeather` | Accesses `data.weather[0].description` without checking array length. If API returns empty `weather` array, it throws `TypeError` (caught by outer catch but returns a less descriptive error). | Guard with `data.weather?.[0]` or provide a fallback string. |
| LOW | `fetchForecast` – `forEach` body inside `formatForecast` | The truncated code appears to end after `byDate.set(date, []); }` without pushing the item. If the actual file is exactly as shown, the day-grouping map remains empty. | Ensure `byDate.get(date)!.push(item);` is present after the `if` block. |

**Risk verdict:** HIGH – Missing hourly forecast path and lack of module exports render the tool non-functional.

---

## SV036 — audit — `innomcp-server-node/src/mcp/tools/webdTools.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `webdTool_group` lines ~68-82 and `webdTool_platforms` equivalent cookie extraction | Only the first `Set-Cookie` header is captured because `headers.get()` returns a single value. Multiple cookies required for CSRF sessions are lost, causing subsequent POST requests to fail with CSRF mismatch (403). | Use `Headers.getSetCookie()` (Node 18+) or iterate `response.headers.entries()` to collect all `set-cookie` headers. Example: `const setCookies = (csrfRes.headers as any).getSetCookie?.() ?? [];` |
| HIGH | Both tools: lines ~72 (csrf error) and ~105 (post error) where `throw` happens before consuming the response body | When `csrfRes.ok` or `postRes.ok` is false, the code throws without reading the response body. This leaves the TCP connection unconsumed, causing socket and memory leaks that can exhaust resources over time. | Always consume the response body even on error – call `await res.text()` or `res.body?.cancel()` before throwing, or use a wrapper that drains the response. |
| MEDIUM | Both tools: whole handler block | No timeout or abort signal is attached to `fetch` calls. A stalled backend can hang the tool indefinitely, blocking the MCP server’s event loop and causing client timeouts or resource starvation. | Create an `AbortController` with a sensible timeout (e.g., 10 s) and pass `signal` to all fetch calls; catch `AbortError` and return a graceful error message. |
| LOW | Both tools: error message formatting (e.g., lines ~126-128) | Error responses returned to the client expose internal host and port (`http://${webddsbHost}:${webddsbPort}`), which leaks infrastructure details to end users. | Replace the host/port with a generic label like “backend service” and log the actual details securely on the server side. |
| LOW | Both tools: tool registration omits `parameters` Zod schema | The handler casts arguments via `as WebdInput` but no input validation schema is provided to the MCP server, so malformed or unexpected arguments are not rejected, leading to potential runtime errors. | Add a Zod schema (e.g., `parameters: z.object({ query: z.string().optional() })`) to the tool settings so input is validated automatically. |

1-line risk verdict: **Critical cookie loss and resource leaks make the tools unreliable and unsafe for production; deploy only after fixing high-severity items.**

---

## SV037 — audit — `innomcp-server-node/src/mcp/tools/worldBankTool.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `resolveIndicatorCode` (loop over `COMMON_INDICATORS`) | Partial match returns first key containing input substring; e.g., input "GDP_GROWTH" matches "GDP" and returns `NY.GDP.MKTP.CD` instead of `NY.GDP.MKTP.KD.ZG`, producing wrong data silently. | Remove partial matching loop; only exact‑match keys or let the caller supply the exact indicator code. |
| MEDIUM | `formatWorldBankData` trend calculation | Percent change `(change / oldest.value) * 100` → `NaN` when `oldest.value === 0`, output displays “NaN%”. | Guard division: if `oldest.value === 0` omit percent change or output “∞” / “N/A”. |
| MEDIUM | `worldBankToolInputSchema` + country trimming | `z.string().min(2)` allows whitespace‑only strings (e.g., `"  "`), which after `.trim()` become empty and produce malformed API URLs. | Use `.trim().min(2)` or `.refine(s => s.trim().length >= 2)` in Zod schema. |
| LOW | Zod schema `startYear`/`endYear` | No validation that `startYear <= endYear`; passing a reversed range may return empty/different data. | Add `.refine(({startYear, endYear}) => !startYear || !endYear || startYear <= endYear, { message: 'startYear must not be later than endYear' })`. |

**Risk verdict:** High likelihood of silently returning wrong economic indicators due to faulty partial matching, undermining data trustworthiness.

---

## SV038 — audit — `innomcp-server-node/src/memory/embedding.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|--------------|
| MEDIUM | `embed()` method, timeout logic | `setTimeout` timer not cleared when `fetch` throws (e.g. network error) or when caught exception occurs before `clearTimeout`, causing timer leak. Each failed call leaves an active timer that eventually fires a no-op abort, wasting resources and potentially interfering with future operations in long-running processes. | Migrate to `AbortSignal.timeout(this.timeoutMs)` (available in Node 17+, modern runtimes) to eliminate manual timer management – reduces code complexity and guarantees cleanup. Alternatively wrap in `try...finally` to ensure `clearTimeout(timeoutId)`. |
| LOW | `embed()` method, response processing | `data.embedding` is returned without type-checking; if the API returns a non-array, or an array containing non-numbers, the promise resolves with a value that violates the `number[] | null` contract, causing silent downstream type errors. | Validate `Array.isArray(data.embedding) && data.embedding.every(n => typeof n === 'number')` before returning; otherwise return `null`. |

**Risk verdict:** Timer leak on errors and absent response shape validation create silent resource waste and type-safety gaps, risking gradual performance degradation and cryptic downstream failures.

---

## SV039 — audit — `innomcp-server-node/src/memory/vectorStore.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH     | `save()` catch block | Errors during file write are silently swallowed; callers have no way to know if persistence succeeded, risking silent data loss. | Rethrow the error or return a boolean/result. Let the caller handle logging and recovery. |
| HIGH     | `load()` and `add()` interleaving | Concurrent calls to `load()` and `add()` cause a race: `add()` pushes items into `this.items`, then `load()` overwrites `this.items` (even with loaded data), discarding the newly added items. | Sequence initialisation: call `load()` only once before serving. Alternatively, add a lock or make `load()` return a fresh instance. |
| MEDIUM   | `searchByKeyword()` filter | `item.content.toLowerCase()` throws TypeError when `item.content` is `undefined` or `null`. No guard ensures content is a string. | Add a check: `item.content && item.content.toLowerCase().includes(lowerQuery)`, or enforce content validity on `add()`. |
| MEDIUM   | `load()` catch block | Catches all errors (e.g., JSON parse, permissions) and logs “No existing memory file found”, resetting `this.items` to `[]`. This discards pre-existing in-memory items and masks failure. | Check for `ENOENT` only; rethrow other errors. Only clear items if the file truly does not exist. |

**Risk Verdict:** Unsafe for concurrent use; silent error suppression in persistence leads to unobservable data loss, and missing input validation can crash search operations.

---

## SV040 — audit — `innomcp-server-node/src/server.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `sendJsonRpcError` function, lines ~34-36 | Missing null check on `res` allows `res.status().json()` call when `res` is falsy, causing an uncaught TypeError crash. | Change guard to `if (!res || res.headersSent) { return; }` to safely exit when `res` is null or undefined. |

Risk verdict: "Unhandled TypeError crash path in error helper; no other defects surfaced in the provided (truncated) module."

---

## SV041 — audit — `innomcp-server-node/src/tools/registerExtraTools.ts` [deepseek/deepseek-v4-pro]
| Severity | Location                                                                 | Issue                                                                                   | Proposed Fix                                                                                             |
|----------|--------------------------------------------------------------------------|-----------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| HIGH     | `registerExtraTools` function body (lines 15–21)                         | Function is a no-op: all tool registration calls are commented out and only logs a TODO message. Calling it will never register any extra tools, causing a silent failure where expected functionality is absent with no error or warning. | Remove the placeholder logging and either uncomment the registration calls (ensuring the tool modules exist) or, if the modules are unavailable, throw an `Error` with a clear message indicating the missing modules. |

**Risk Verdict:** `registerExtraTools()` is a silent no-op, causing all extra tools to be permanently missing with zero feedback.

---

## SV042 — audit — `innomcp-server-node/src/utils/cache.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| MEDIUM | `clearCachePattern` | Pattern matching is broken: only the first `*` is removed, and `String.includes` on the result matches unintended substrings. Keys may be incorrectly deleted or missed. | Replace with a robust glob→regex conversion (escape special chars, replace `*` with `.*`) and test against keys. |
| LOW | top-level `setInterval` | The interval runs forever with no exported stop/cleanup function. In environments that expect graceful shutdown, it may keep the event loop alive. | Store the interval ID and export a `stopCacheCleanup()` function, or call `.unref()` on the interval. |

**Risk verdict:** Cache pattern clearing is broken; orphan interval prevents clean shutdown.

---

## SV043 — audit — `innomcp-server-node/src/utils/db.ts` [deepseek/deepseek-v4-pro]
| Severity | Location          | Issue                                                                                                          | Proposed Fix                                                                                                      |
|----------|-------------------|----------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| HIGH     | Module (global)   | No pool shutdown or cleanup method; leaked connections and open handles prevent graceful process termination.    | Implement a `closePool()` using `pool.end()` and call it on `SIGTERM`/`SIGINT`, or export a destroy function.     |
| MEDIUM   | `connectWithRetry()` | Function name implies retry logic but contains none—single `getConnection()` call with no retry loop.           | Rename to `connect()` or implement retry with attempts and backoff (e.g., async retry pattern).                   |
| MEDIUM   | `getPool()`       | Environment variables (DB_HOST, DB_PORT, etc.) used without validation; `Number(undefined)` yields `NaN` for port, causing obscure connection failures. | Validate env vars on startup, set safe defaults (host: `'127.0.0.1'`, port: `3306`) or throw a clear error.     |
| LOW      | `query<T>()`      | Type assertion `rows as T` is unchecked; mismatched result shapes cause silent runtime failures.                 | Add runtime validation or accept the inherent risk; consider using schema validation libraries.                   |

**Risk verdict:** Uncontrolled connection leakage and missing environment validation create brittle production behaviour and silent failures; address the high-severity leak and misleading retry immediately.

---

## SV044 — audit — `innomcp-server-node/src/utils/dbDetect.ts` [deepseek/deepseek-v4-pro]
| severity | location | issue | proposed fix |
|----------|----------|-------|---------------|
| HIGH | `getPoolDetect` function (line ~38) | Race condition: unprotected lazy init of `poolDetect` can create multiple `mysql.Pool` instances when called concurrently, leaking connections and resources. | Use a promise-based single-instance pattern. For example: declare `let poolDetectPromise: Promise<mysql.Pool> | null = null;` and modify `getPoolDetect` to return `await (poolDetectPromise = poolDetectPromise ?? (async () => { const cfg = resolveDetectDbConfig(); return mysql.createPool(cfg); })());`. Update callers to `await getPoolDetect()`. |

**Risk verdict:** Concurrent startup queries can exhaust connection limits due to leaked duplicate pools.

---

## SV045 — audit — `innomcp-server-node/src/utils/mcpLogger.ts` [deepseek/deepseek-v4-pro]
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `mcpLog()` (line with `JSON.stringify(data, null, 2)`) | Unhandled exception if `data` contains circular references or `toJSON` throws, crashing the process. | Wrap `JSON.stringify` in try-catch; on failure, fall back to `String(data)`. |
| HIGH | Module top-level directory creation (`fs.mkdirSync` in `forEach`) | Uncaught `fs.mkdirSync` failure (e.g., permissions) causes process crash at import time. | Wrap directory creation in try-catch; on error, log warning and continue (console-only logging). |
| MEDIUM | `mcpLog()` – `fs.appendFileSync` calls | Synchronous file writes block the event loop, causing latency under moderate log volume. | Switch to `fs.promises.appendFile` or a queued async write stream. |
| MEDIUM | `PROJECT_LOG_DIR` / `ROOT_LOG_DIR` derivation from `__dirname` | When installed as a dependency, logs are written inside `node_modules`, risking permission issues and disk clutter. | Use a configurable base path (e.g., `LOG_DIR` env var) or OS temp directory. |

**Risk verdict:** High risk: unhandled JSON.stringify and mkdir exceptions can crash the process; synchronous I/O blocks the event loop.