<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-011 role=fuzz model=deepseek/deepseek-v4-flash
 finish_reason: length | tokens: {"prompt_tokens":2732,"completion_tokens":5000,"total_tokens":7732,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4342,"image_tokens":0},"cache_creation_input_tokens":0} | 54s
 generated: 2026-06-13T12:01:25.399Z -->
- **Property**: trigToDeg appends " deg" after numeric argument inside trig functions → **Fuzz input**: `"sin(45)"` → **Expected invariant**: returns `"sin(45 deg)"`
- **Property**: trigToDeg handles negative decimal numbers → **Fuzz input**: `"cos(-3.14)"` → **Expected invariant**: returns `"cos(-3.14 deg)"`
- **Property**: trigToDeg does not modify arguments containing "deg", "rad", or "pi" → **Fuzz input**: `"tan(pi/4)"` → **Expected invariant**: returns `"tan(pi/4)"`
- **Property**: trigToDeg does not modify arguments with "deg" keyword → **Fuzz input**: `"sin(45 deg)"` → **Expected invariant**: returns `"sin(45 deg)"`
- **Property**: trigToDeg does not modify non-numeric arguments → **Fuzz input**: `"asin(x)"` → **Expected invariant**: returns `"asin(x)"`
- **Property**: trigToDeg handles multiple trig calls in one expression → **Fuzz input**: `"sin(30)+cos(60)"` → **Expected invariant**: returns `"sin(30 deg)+cos(60 deg)"`
- **Property**: trigToDeg does not throw for empty string → **Fuzz input**: `""` → **Expected invariant**: returns `""`
- **Property**: trigToDeg does not throw for string without trig functions → **Fuzz input**: `"hello world"` → **Expected invariant**: returns `"hello world"`
- **Property**: trigToDeg does not throw on nested parentheses (incorrect match) → **Fuzz input**: `"sin((1))"` → **Expected invariant**: returns a string (no exception)
- **Property**: cleanFloat returns integer string for integer input → **Fuzz input**: `5` → **Expected invariant**: returns `"5"`
- **Property**: cleanFloat rounds near-integer to integer → **Fuzz input**: `0.9999999999999999` → **Expected invariant**: returns `"1"`
- **Property**: cleanFloat returns up to 10 decimal places → **Fuzz input**: `0.123456789123456` → **Expected invariant**: returns `"0.1234567891"` (rounded)
- **Property**: cleanFloat returns "NaN" for NaN → **Fuzz input**: `NaN` → **Expected invariant**: returns `"NaN"`
- **Property**: cleanFloat returns "Infinity" for Infinity → **Fuzz input**: `Infinity` → **Expected invariant**: returns `"Infinity"`
- **Property**: cleanFloat returns "0" for negative zero → **Fuzz input**: `-0` → **Expected invariant**: returns `"0"`
- **Property**: handleFastPathMessage returns `handled: false` and `latencyMs: 0` when mode is "off" → **Fuzz input**: `opts: { mode: "off" }`, text: `"hello"` → **Expected invariant
