<!-- cc-team deliverable
 group: G1 (Fix patches from improve audit findings)
 member: FIX-015 role=fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2344,"completion_tokens":5459,"total_tokens":7803,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3752,"image_tokens":0},"cache_creation_input_tokens":0} | 69s
 generated: 2026-06-13T11:28:29.993Z -->
## Finding: Rule 3 – raw JSON top-level leak (preamble bypass + missing non-" first value)

`RAW_JSON_RE` only checks the very start of the trimmed answer, so any lead-in like `"สรุป: {...}"` leaks raw JSON. Also the `\s*"` requires the first value after `{` or `[` to be a quoted string, missing arrays starting with a number or boolean.

**Fix:** Replace the single regex with a two‑stage check – the whole answer as balanced JSON object/array, and any mid‑answer line that starts a JSON block.

```typescript
// --- Patch: Rule 3 ---
// Remove the old RAW_JSON_RE line and the if block that uses it.
// Replace with:

// Whole-answer raw JSON check: trimmed string is a balanced JSON object/array
const pureJsonRe = /^\s*(?:[\{\[]\s*(?:[^{}\[\]"]*"(?:\\.|[^"\\])*")*\s*[\}\]])\s*$/;
// Mid-answer JSON block: line that starts with { or [ then a " after optional whitespace
const midJsonRe = /\n\s*[\{\[]\s*"/;

if (pureJsonRe.test(trimmed) || midJsonRe.test(candidate)) {
  return {
    ok: false,
    ruleFired: "raw-json-leak",
    hint: "อย่าตอบเป็น JSON ดิบ — โปรดเรียบเรียงเป็นข้อความภาษาไทย",
  };
}
// --- end patch ---
```

## Finding: Rule 2 – first‑50 check missing Thai after an English lead‑in

The check `!hasThaiCharacter(trimmed.slice(0, 50))` causes a false positive when a Thai answer starts with an English nicety like `"Sure! Here you go:\n\nแนะนำ..."`.

**Fix:** Require Thai anywhere in the first **200** characters, so a short English preamble doesn’t trigger.

```typescript
// --- Patch: Rule 2 (first N chars) ---
// In checkNaturalness(), after the "Rule 2: Thai query…" comment,
// change the condition from trimmed.slice(0, 50) to trimmed.slice(0, 200):

if (userIsThai && startsWithEnglish(trimmed) && !hasThaiCharacter(trimmed.slice(0, 200))) {
  return {
    ok: false,
    ruleFired: "english-first-leak",
    hint: "คำถามเป็นภาษาไทย แต่คำตอบขึ้นต้นด้วยภาษาอังกฤษ — โปรดขึ้นต้นด้วยภาษาไทย",
  };
}
// --- end patch ---
```

## Finding: Rule 2 – invisible characters (BOM, ZWJ, NBSP) bypass `startsWithEnglish`

`startsWithEnglish` uses `s.trim()` but standard `.trim()` doesn’t remove BOM (`\uFEFF`), zero‑width characters (`\u200B`–`\u200D`), or non‑breaking space (`\u00A0`). A BOM‑prefixed answer skips the rule entirely.

**Fix:** Normalise the string before testing, stripping these invisible code points.

```typescript
// --- Patch: function startsWithEnglish ---
function startsWithEnglish(s: string): boolean {
  // Strip standard whitespace AND invisible/zero-width/BOM characters
  const cleaned = s.replace(/^[\s\uFEFF\u200B-\u200D\u00A0]+/, "");
  return /^[A-Za-z]/.test(cleaned);
}
// --- end patch ---
```

## Finding: Rule 4/5 – generic `guard-violation` hides the real cause

When `checkVisibleTextSafe` rejects but doesn’t have a `forbiddenSubstring`, the fallback id is `"guard-violation"`, giving the same hint for both “Used tools: none” and map‑placeholder leaks. The Stylist/Conductor then retries the wrong thing.

**Fix:** Branch on `guard.ruleFired` (which we assume `eventGuard` returns) to set rule‑specific ids and hints.

```typescript
// --- Patch: Rule 4 + 5 delegation ---
// Replace the existing guard block entirely:
const guard = checkVisibleTextSafe(trimmed, {
  allowMapTerms: opts.intent === "map",
  expectedToolUsage: opts.expectedToolUsage,
});
if (!guard.ok) {
  // Use the internal ruleFired when available, otherwise build from forbiddenSubstring
  const ruleId = guard.ruleFired
    ? guard.ruleFired
    : guard.forbiddenSubstring
      ? `forbidden-substring:${guard.forbiddenSubstring}`
      : "guard-violation";
  let hint: string;
  if (guard.ruleFired === "tools-none-when-expected") {
    hint = "คำตอบไม่ควรมี 'Used tools: none' — โปรดเรียกใช้เครื่องมือที่จำเป็นแล้วอธิบาย";
  } else if (guard.ruleFired === "map-placeholder-leak") {
    hint = "พบข้อความแผนที่ placeholder — โปรดตัดออกหรือแทนที่ด้วยแผนที่จริง";
  } else {
    hint = "พบข้อความที่ไม่เหมาะกับคำตอบนี้ — โปรดตัดข้อความ placeholder/map warning ออก";
  }
  return { ok: false, ruleFired: ruleId, hint };
}
// --- end patch ---
```

## Finding: Rule 1 – permissive province‑request regex allows dangerous trailing content

`PROVINCE_REQUEST_RE` ends with `[^\n]*$`, so a string like `"กรุณาระบุจังหวัด <script>…"` passes the check and is treated as a legitimate province‑only answer.

**Fix:** Replace the regex with an explicit allowlist of the known canned phrases (exact match after trimming).

```typescript
// --- Patch: Rule 1 ---
// Remove the PROVINCE_REQUEST_RE constant and the if block that uses it.
// Add the allowlist and exact-match check just before Rule 1:

const CANNED_PROVINCE_PHRASES = new Set([
  "กรุณาระบุจังหวัด",
  "กรุณาระบุพื้นที่",
  "โปรดระบุจังหวัด",
  "โปรดระบุพื้นที่",
  "please specify province",
  "please specify area",
  "please specify location",
]);

// Inside checkNaturalness, replace the old Rule 1 check:
if (
  opts.intent === "planning-broad" &&
  CANNED_PROVINCE_PHRASES.has(trimmed.toLowerCase())
) {
  return {
    ok: false,
    ruleFired: "planning-broad-province-only",
    hint:
      "อย่าตอบแค่ 'กรุณาระบุจังหวัด' — ให้เสนอแนวทางวางแผนแบบมีสมมติฐาน " +
      "พร้อม first-pass plan และคำถามต่อ 1–3 ข้อ",
  };
}
// --- end patch ---
```

## Finding: Rule 6 – `hasPlanFrame` matches incidental English tokens

Words like `"first-pass"` or `"criteria"` can appear in otherwise shallow English prose, making the rule miss a really shallow answer. The regex should focus on Thai planning‑specific terms.

**Fix:** Remove `"first-pass"` from the `hasPlanFrame` pattern and add more robust Thai planning keywords.

```typescript
// --- Patch: Rule 6 hasPlanFrame regex ---
// In the planning-broad rule, replace the existing hasPlanFrame definition:
const hasPlanFrame = /(แนวทาง|เกณฑ์|ขั้นตอน|วิธี|ปัจจัย|วางแผน|กลยุทธ์|แผนงาน)/.test(trimmed);
// Note: removed "first-pass" (English false-positive) and added "วางแผน", "กลยุทธ์", "แผนงาน"
// --- end patch ---
```
