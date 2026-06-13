<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-019 role=fuzz model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":2274,"completion_tokens":3366,"total_tokens":5640,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":611,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 28s
 generated: 2026-06-13T12:04:10.273Z -->
# Property-Based & Fuzz Test Cases: `providerHealthProbe.ts`

## 1. Status Validity

- **Property**: Every `ProviderProbeResult.status` is always one of `"online"|"offline"|"configured"|"checking"` — never `undefined`, `null`, empty string, or any other value.
  - **Fuzz input**: All 19 providers with `baseUrl` pointing at servers returning random status codes (0, 1, 302, 403, 404, 418, 429, 500, 502, 503, 999, NaN-coded status).
  - **Expected invariant**: `result.status ∈ {"online","offline","configured","checking"}` for every provider.

- **Property**: Empty `apiKey` on an `openai`-kind provider always yields `"configured"`, never `"online"` or `"offline"`.
  - **Fuzz input**: `apiKey: ""` with a live `baseUrl` returning 200.
  - **Expected invariant**: `result.status === "configured"`.

- **Property**: Empty `apiKey` on an `anthropic`-kind provider always yields `"configured"`.
  - **Fuzz input**: `apiKey: ""` with a live `baseUrl` returning 200.
  - **Expected invariant**: `result.status === "configured"`.

- **Property**: Empty `apiKey` on an `ollama`-kind provider does **not** yield `"configured"` — ollama ignores apiKey; status depends on HTTP response.
  - **Fuzz input**: `apiKey: ""`, ollama server returning 200.
  - **Expected invariant**: `result.status === "online"` (not `"configured"`).

## 2. No Unhandled Exceptions

- **Property**: `probeAll()` (or equivalent entry point) never throws, regardless of input.
  - **Fuzz input**: All env vars set to `undefined`; `baseUrl` values of `""`, `"not a url"`, `"http://[::1]"`, `"ftp://evil.com"`, `"javascript:alert(1)"`, `null`, `"http://0.0.0.0:0"`, `"http://\x00host"`, extremely long string (65KB).
  - **Expected invariant**: Function returns/resolves without throwing; `probeStatus` map populated for every provider.

- **Property**: Individual probe functions never throw — all errors caught internally.
  - **Fuzz input**: `baseUrl` pointing at a TCP server that immediately RSTs; a server that sends garbage binary; a server that sends an infinite response body with no end; DNS that never resolves.
  - **Expected invariant**: No exception propagates; result is `"offline"`.

## 3. Timeout Enforcement

- **Property**: Every probe completes within ≤5 seconds (plus minor overhead).
  - **Fuzz input**: `baseUrl` pointing at a server that hangs for 30s before responding.
  - **Expected invariant**: `result.status === "offline"` and `result.latencyMs < 6000`.

- **Property**: Timeout fires even when DNS resolution is slow.
  - **Fuzz input**: `baseUrl` with a hostname that has 4.9s DNS TTL then hangs on connect.
  - **Expected invariant**: `result.status === "offline"`.

## 4. Latency Non-Negativity

- **Property**: `latencyMs` is always ≥ 0 and finite.
  - **Fuzz input**: System clock set to past (simulated), `Date.now()` mocked to return `0`, `Infinity`, or negative values.
  - **Expected invariant**: `result.latencyMs >= 0 && Number.isFinite(result.latencyMs)`.

## 5. ISO-8601 Timestamp

- **Property**: `checkedAt` is always a valid ISO-8601 string parseable by `Date.parse()`.
  - **Fuzz input**: Run probe with system clock mocked to `new Date(0)`, `new Date(8640000000000001)` (out of range), `new Date(NaN)`.
  - **Expected invariant**: `!isNaN(Date.parse(result.checkedAt))` — always a valid date string.

## 6. Provider ID Consistency

- **Property**: Each `ProviderProbeResult.providerId` exactly matches the corresponding `ProbeTarget.id`.
  - **Fuzz input**: Targets with `id` containing unicode (`"日本語"`), special chars (`"a/b?c=d&e"`), empty string `""`, very long string (10KB), duplicate ids.
  - **Expected invariant**: `result.providerId === target.id` for every entry.

## 7. Map Completeness

- **Property**: After probing, `probeStatus.size` equals the number of targets returned by `buildProbeTargets()`.
  - **Fuzz input**: All env vars set to valid-but-diverse values; all env vars set to `undefined`.
  - **Expected invariant**: `probeStatus.size === buildProbeTargets().length` (19).

- **Property**: No stale entries — re-running probe replaces all existing entries.
  - **Fuzz input**: Run probe twice with different network conditions (first: all offline; second: all online).
  - **Expected invariant**: `probeStatus.get(id).status` reflects the latest probe, not a merge of old+new.

## 8. BaseURL Normalization

- **Property**: Trailing slashes on `baseUrl` are handled without double-slash in the final URL.
  - **Fuzz input**: `baseUrl: "https://api.openai.com/v1/"` (trailing slash), `baseUrl: "https://api.openai.com/v1"` (no trailing slash), `baseUrl: "https://api.openai.com/v1///"`.
  - **Expected invariant**: Probe sends request to a valid URL (no `//api/tags` or `//chat/completions`); result is `"online"` or `"offline"`, never an unhandled error.

- **Property**: `commandCodeBaseUrl` trailing-slash strip via `.replace(/\/$/, "")` works for all edge cases.
  - **Fuzz input**: `COMMANDCODE_BASE_URL` = `"https://api.commandcode.ai/provider/v1/"`, `"https://api.commandcode.ai/provider/v1"`, `"https://api.commandcode.ai/provider/v1///"`, `""`, `"   "`.
  - **Expected invariant**: No double-slash in constructed URL; no crash.

## 9. Env Var Injection / Malformed Input

- **Property**: All env var reads are safe when values contain unexpected characters.
  - **Fuzz input**: `OPENAI_BASE_URL` = `"\x00"`, `"http://\nhost"`, `"http://host\r\nX-Inject: evil"`, `"  "`, `"http://host:99999"`, `"http://host:abc"`, `"http://"`; `OPENAI_API_KEY` = `"key with spaces"`, `"key\nwith\nnewlines"`, `"key\x00null"`, 1MB string.
  - **Expected invariant**: No crash; result is `"offline"` or `"configured"` (for empty key); no HTTP header injection.

- **Property**: `OPENAI_FALLBACK_MODELS` parsing is safe.
  - **Fuzz input**: `OPENAI_FALLBACK_MODELS` = `""`, `","`, `",,,,"`, `"  model1  ,  model2  "`, `"a\x00b"`, 10KB comma-separated string.
  - **Expected invariant**: First non-empty trimmed model is used; no crash.

- **Property**: `commandCodeUsesOpenAiProxyShape` regex is safe against adversarial URLs.
  - **Fuzz input**: `COMMANDCODE_BASE_URL` = `"http://127.0.0.1:4322"`, `"http://localhost:4322/v1"`, `"http://host.docker.internal:4322"`, `"https://api.commandcode.ai/provider/v1"`, `"https://api.commandcode.ai/provider/v2"`, `"http://127.0.0.1:4322.evil.com"`.
  - **Expected invariant**: `kind` is correctly `"openai"` or `"anthropic"`; no regex bypass leading to wrong probe strategy.

## 10. HTTP Response Edge Cases

- **Property**: Non-200 responses for `ollama` always yield `"offline"`.
  - **Fuzz input**: Mock server returning 201, 204, 301, 302, 400, 401, 403, 500, 503.
  - **Expected invariant**: `result.status === "offline"` for all non-200.

- **Property**: 200 and 401 for `openai` yield `"online"`; all others yield `"offline"`.
  - **Fuzz input**: Mock server returning 200, 201, 400, 401, 403, 429, 500.
  - **Expected invariant**: 200→`"online"`, 401→`"online"`, everything else→`"offline"`.

- **Property**: 200, 400, and 401 for `anthropic` yield `"online"`; all others yield `"offline"`.
  - **Fuzz input**: Mock server returning 200, 400, 401, 403, 429, 500.
  - **Expected invariant**: 200→`"online"`, 400→`"online"`, 401→`"online"`, everything else→`"offline"`.

- **Property**: Response body is never parsed in a way that causes a crash.
  - **Fuzz input**: Mock server returning binary garbage, `{"error":`, `<html>...</html>`, empty body, 10MB body, body with null bytes.
  - **Expected invariant**: No crash; status determined solely by HTTP status code.

## 11. Concurrency & Race Conditions

- **Property**: Concurrent calls to the probe entry point do not corrupt `probeStatus`.
  - **Fuzz input**: Call `probeAll()` 10 times concurrently with different mock backends.
  - **Expected invariant**: `probeStatus` contains exactly 19 entries; each entry is a valid `ProviderProbeResult`; no partial writes or `undefined` values.

- **Property**: `Promise.allSettled` guarantees all providers are attempted even if one hangs.
  - **Fuzz input**: Provider 1 hangs for 30s; all others respond instantly.
  - **Expected invariant**: All 19 providers have entries in `probeStatus`; provider 1 is `"offline"`; others have correct statuses.

## 12. Kind-Specific Probe URL Construction

- **Property**: `ollama` probes always hit `{baseUrl}/api/tags` with GET.
  - **Fuzz input**: `baseUrl` = `"https://ollama.example.com"`, `"https://ollama.example.com/"`, `"https://ollama.example.com/v1"`.
  - **Expected invariant**: Request URL is exactly `https://ollama.example.com/api/tags` (or `…/v1/api/tags` if baseUrl includes `/v1`); method is GET.

- **Property**: `openai` probes always hit `{baseUrl}/chat/completions` with POST and a minimal body.
  - **Fuzz input**: Various `baseUrl` values; `model` = `""`, `"a".repeat(10000)`, `"model/with/slashes"`.
  - **Expected invariant**: Request body contains `model` field; `max_tokens` is 1; method is POST.

- **Property**: `anthropic` probes always hit `{baseUrl}/messages` with POST and required headers.
  - **Fuzz input**: `apiKey` = `"sk-ant-..."`, `model` = `"claude-haiku-4-5-20251001"`.
  - **Expected invariant**: Request includes `x-api-key` header and `anthropic-version` header; body has `max_tokens: 1`.

## 13. Duplicate Provider IDs

- **Property**: If `buildProbeTargets()` returns duplicate `id` values, the last one wins in `probeStatus` (Map semantics).
  - **Fuzz input**: Mock env vars so two targets share `id: "openai-gpt"`.
  - **Expected invariant**: `probeStatus.size <= buildProbeTargets().length`; no crash; last-write-wins semantics.

## 14. AbortController Cleanup

- **Property**: Abort signal is always cleaned up after probe completes (no resource leak).
  - **Fuzz input**: 19 providers, all responding within 1ms.
  - **Expected invariant**: No dangling timers or AbortController references after all probes resolve.

- **Property**: Abort fires correctly when response is slow but not infinite.
  - **Fuzz input**: Server responds in 4999ms (just under timeout).
  - **Expected invariant**: `result.status === "online"` (or appropriate status based on response code); `result.latencyMs >= 4999`.
