<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D009 role=doc model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":4133,"completion_tokens":4003,"total_tokens":8136,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2976,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 31s
 generated: 2026-06-13T11:20:30.299Z -->
- **`LOW_CONFIDENCE_FALLBACK_TEXT`**
  Thai constant string prompting the user for more specific details (e.g., province or topic) when the system cannot confidently answer.
  Caveat: Hardcoded Thai string; used as a default fallback in `renderGeneralSmokeAnswer` for non-Thai inputs that match no patterns.

- **`renderGeneralFallbackMessage`**
  Returns a Thai processing message indicating the system is coordinating data, advising the user to provide more specific context if the wait is too long.
  `@returns {string}` The formatted fallback message.

- **`renderThaiNumberText`**
  Converts a finite number into its Thai textual representation (e.g., 21 → "ยี่สิบเอ็ด").
  `@param {number} value` - The number to convert.
  `@returns {string}` The Thai number string, or the stringified input if it's not a finite number.
  Caveat: Truncates decimals via `Math.floor`. Correctly supports numbers up to 999,999,999,999; larger numbers will produce incorrect output because the internal `positions` array lacks strings for billions and beyond.

- **`countDaysUntilEndOfYear`**
  Calculates the number of days remaining from a given date until December 31st of the same year.
  `@param {Date} baseDate` - The starting date.
  `@returns {number}` Whole days remaining in the year. Returns `0` if `baseDate` is past Dec 31.

- **`renderGeneralSmokeAnswer`**
  Matches user input against a series of Thai/English regex patterns to return predefined FAQ answers or system status messages.
  `@param {string} userText` - The raw user input string.
  `@returns {string}` The matched predefined Thai response.
  Caveat: Pattern matching is sequential and stops at the first match. Returns `LOW_CONFIDENCE_FALLBACK_TEXT` if the input contains no Thai characters and matches no earlier patterns.
