<!-- cc-team deliverable
 group: G4 (Generate jest unit tests for untested innomcp-node modules (batch 4))
 member: E003 role=test-edge model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":4091,"completion_tokens":8000,"total_tokens":12091,"prompt_tokens_details":{"cached_tokens":9,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 86s
 generated: 2026-06-13T11:11:13.344Z -->
The user wants a Jest edge-case/error-path unit test for the `generalGate` module in `innomcp-node`. 

Key requirements:
1. Import exactly as: `import ... from '../src/services/generalGate';`
2. Focus ONLY on edge cases, error handling, boundary conditions, null/empty/malformed inputs, thrown errors, and failure/fallback paths of the PUBLIC API.
3. Mock external dependencies with `jest.mock()`. The source imports `logBoth` from `"../utils/mcpLogger"`, so I need to mock that.
4. Use fake timers for any time/interval logic. The module has `countDaysUntilEndOfYear` which uses `Date`, but no intervals. However, I should use fake timers if testing time-related logic, though `countDaysUntilEndOfYear` takes a `baseDate` parameter and doesn't use the system clock directly. But the instructions say "Use fake timers for any time/interval logic." Since `countDaysUntilEndOfYear` creates `new Date()` internally based on `baseDate.getFullYear()`, it doesn't strictly need fake timers, but I can use them or not. Actually, looking at the function, it uses `baseDate.getFullYear()` etc. to construct dates, so it's deterministic given input. But to be safe and follow rules, I can use fake timers in beforeEach/afterEach.
5. Must compile under strict TypeScript and pass without live server or DB.
6. Output ONLY one fenced typescript code block with the complete test file and NOTHING else.

Public API from the source:
- `LOW_CONFIDENCE_FALLBACK_TEXT` (constant)
- `renderGeneralFallbackMessage()` (function)
- `renderThaiNumberText(value: number)` (function)
- `countDaysUntilEndOfYear(baseDate: Date)` (function)
- `renderGeneralSmokeAnswer(userText: string)` (function)

Edge cases to cover:
- `renderThaiNumberText`:
  - `NaN` (not finite)
  - `Infinity`, `-Infinity`
  - `0`
  - Negative numbers
  - Very large numbers (>= 1,000,000)
  - Decimal numbers? The function uses `Math.floor`, so decimals are truncated. Edge case: `1.9`, `-1.9`
  - Numbers with zeros in between digits
  - `1` at unit position after tens (should be "เอ็ด")
  - `2` in tens position (should be "ยี่สิบ")
  - `1` in tens position (should be "สิบ")
  
- `countDaysUntilEndOfYear`:
  - Date at end of year (Dec 31) -> should be 0
  - Date at beginning of year (Jan 1) -> should be 364 or 365 depending on leap year? Wait, the function calculates from baseDate to Dec 31 of same year. Jan 1 to Dec 31 is 364 days? No: Jan 1 to Dec 31 inclusive? Let's check: `start` is set to baseDate's year/month/date. `end` is Dec 31 same year. Difference in ms divided by 86400000 and rounded. For Jan 1, 2023: start=2023-01-01, end=2023-12-31. Difference = 364 days? Actually Jan 1 to Dec 31 is 364 days later if not counting Jan 1? Let's calculate: Jan 1 to Jan 2 is 1 day. Jan 1 to Dec 31 is 364 days (since 365 days in year, minus 1). But wait, 2023 is not leap year. Jan 1 to Dec 31 = 364 days. For leap year 2024: Jan 1 to Dec 31 = 365 days. But the function doesn't account for leap years explicitly; it just uses Date math. So it should be correct. Edge cases: Dec 31 -> 0. Jan 1 -> 364/365. Also baseDate after Dec 31? Not possible if valid date in year. But what if baseDate is Feb 29 on leap year? Should work. What if baseDate is invalid Date? `new Date(NaN)` would propagate NaN and result in NaN, then Math.max(0, NaN) is NaN? Actually Math.max(0, NaN) is NaN. So that's an edge case.
  - Boundary: Last millisecond of year? The function strips time by using `getFullYear(), getMonth(), getDate()`, so time doesn't matter.
  - Boundary: Date object with mutated prototype? No, keep it simple.

- `renderGeneralSmokeAnswer`:
  - `null`, `undefined`, empty string, whitespace-only -> should hit `LOW_CONFIDENCE_FALLBACK_TEXT` because `String(userText || "")` for null/undefined becomes `""`, trim is empty, then `!/[ก-ฮ]/.test(t)` is true (empty string doesn't match), so returns fallback.
  - Non-string inputs: the function signature says `string`, but JS could pass number/object. `String(userText || "")` handles it. But in TS strict, we test with `any` cast perhaps? Or just test empty/null-like.
  - Malformed strings: very long strings, strings with only special characters.
  - Strings that match regexes partially.
  - Case sensitivity tests.
  - Strings with Thai characters but no match -> fallback.
  - Edge case: string with "ping" but not exactly boundary? The regex `^(ping|pong|alive|status)$` is exact match.
  - Edge case: string that matches the second status regex but not the first.
  - Edge case: string with "RAG" exactly.
  - Edge case: string with "AI" and "คืออะไร" but missing Thai characters? Actually the AI regex is after the non-Thai check? No, the non-Thai check is before the region lookups but after the initial ping/who/status checks. Wait, looking at the code:
    ```typescript
    if (!/[ก-ฮ]/.test(t)) {
      return LOW_CONFIDENCE_FALLBACK_TEXT;
    }
    ```
    This comes AFTER the ping/status/who/help checks. So English-only "ping" will match before the non-Thai check. But English-only "hello" will hit the non-Thai check and return fallback. So edge case: English string that doesn't match early regexes -> fallback.
  - Edge case: string with Thai characters but doesn't match any later regex -> falls through to the end. Wait, the source is truncated at the end with `if (/นับจาก.*ถึง.*อีกกี่วัน|เหล`... so we don't see the final fallback. But we can infer there might be more code or it falls through. Actually the source is truncated. The user provided truncated source. I should only test what's visible. The last visible function is `renderGeneralSmokeAnswer` which is incomplete. However, I can still test the visible branches. But I need to be careful: if the function doesn't have a final return, it returns `undefined` for unmatched cases. But since the source is truncated, I should probably avoid testing paths that rely on the truncated part, OR I can test that for inputs that don't match any visible branch and contain Thai characters, it might return `undefined` (since the function is truncated). But that's risky because the actual file might have more code. However, the instructions say "Do not invent methods" and "Focus ONLY on edge cases... of the PUBLIC API". Given the truncation, I should focus on the functions that are complete: `renderGeneralFallbackMessage`, `renderThaiNumberText`, `countDaysUntilEndOfYear`, and the early branches of `renderGeneralSmokeAnswer` that are visible. I can also test the constant export.

Wait, looking at the truncation: `if (/นับจาก.*ถึง.*อีกกี่วัน|เหล` — this is inside `renderGeneralSmokeAnswer`. Since it's truncated, I cannot reliably test the final return or later branches. But I can test:
- The constant `LOW_CONFIDENCE_FALLBACK_TEXT`
- `renderGeneralFallbackMessage()`
- `renderThaiNumberText` with various edge inputs
- `countDaysUntilEndOfYear` with edge dates
- `renderGeneralSmokeAnswer` with inputs that hit early returns (ping, status, who, help) and inputs that hit the non-Thai fallback, and inputs with Thai that hit visible region branches (e.g., ภาคกลาง). I should avoid testing inputs that would fall through the truncated part without hitting a visible branch, because I don't know what happens. Actually, I can test that it returns the fallback for non-Thai non-matching strings. And for Thai strings matching visible branches, test those. For Thai strings not matching any visible branch, I probably shouldn't test because the truncated code might handle them. But I can test the visible branches.

Actually, looking more carefully at the source, the truncation is at the very end of the file. The function `renderGeneralSmokeAnswer` likely continues. But since I don't know the rest, I should limit tests to complete functions and the parts of `renderGeneralSmokeAnswer` that are fully visible and have explicit returns.

Visible complete branches in `renderGeneralSmokeAnswer`:
1. Short answer regex
2. Ping/status regex
3. Name regex
4. Help regex
5. Non-Thai fallback
6. ภาคกลาง
7. ภาคเหนือ
8. ภาคอีสาน/ตะวันออกเฉียงเหนือ
9. ภาคใต้
10. ภาคตะวันออก (with negative lookahead for เฉียงเหนือ)
11. หาดใหญ่
12. NASA
13. WorldBank
14. RAG
15. AI
16. KPI/OKR
17. Docker
18. Machine Learning
19. The last one is truncated.

So I can test all of these visible branches with edge cases around regex matching, and also test the non-Thai fallback.

For `renderThaiNumberText`, edge cases:
- `NaN` -> returns "NaN" (String(NaN))
- `Infinity` -> "Infinity"
- `-Infinity` -> "ลบInfinity" (since Math.abs(-Infinity) is Infinity, then String(Infinity))
- `0` -> "ศูนย์"
- `-0` -> "ศูนย์"? Let's see: `value < 0` is false for -0, so returns `renderChunk(Math.floor(-0))` which is `renderChunk(0)` -> `""`? Wait, `Math.floor(-0)` is `-0`. Then `String(-0).split("")` gives `["0"]`? Actually `String(-0)` is `"0"`. So `digits = [0]`, then `renderChunk` returns `""` because `num === 0` returns `""`. Then `renderThaiNumberText(-0)` returns `""`. That's an edge case! `value === 0` check uses strict equality, which catches `-0`? In JS, `-0 === 0` is `true`. So it returns `units[0]` which is "ศูนย์". Good.
- `1` -> "หนึ่ง"
- `11` -> "สิบเอ็ด" (1 in tens = "สิบ", 1 in units with digits.length > 1 = "เอ็ด")
- `21` -> "ยี่สิบเอ็ด"
- `101` -> "หนึ่งร้อยเอ็ด"? Let's trace: digits=[1,0,1]. idx=0, digit=1, pos=2 -> "หนึ่งร้อย". idx=1, digit=0 -> "". idx=2, digit=1, pos=0, digits.length>1 -> "เอ็ด". Result: "หนึ่งร้อยเอ็ด". Good.
- `100` -> "หนึ่งร้อย"
- `1000000` -> "หนึ่งล้าน"
- `1000001` -> "หนึ่งล้านเอ็ด"? Wait, millions=1, remainder=1. renderChunk(1) = "หนึ่ง". Then "ล้าน". Then remainder>0 so renderChunk(1). For renderChunk(1): digits=[1], pos=0, digit=1, digits.length is 1 (not >1), so returns units[1] = "หนึ่ง". So result: "หนึ่งล้านหนึ่ง". But wait, in Thai, 1,000,001 is "หนึ่งล้านเอ็ด"? Actually standard Thai: 1,000,001 is "หนึ่งล้านเอ็ด". But the code uses `renderChunk(remainder)` where remainder=1. `renderChunk(1)` with digits.length=1 returns "หนึ่ง", not "เอ็ด". So it's "หนึ่งล้านหนึ่ง". Is that an edge case? Yes, but it's the code's behavior. I should test it.
- `1000010` -> "หนึ่งล้านสิบ"? renderChunk(10): digits=[1,0], pos=1, digit=1 -> "สิบ". pos=0, digit=0 -> "". So "สิบ". Result: "หนึ่งล้านสิบ". Good.
- `1000011` -> "หนึ่งล้านสิบเอ็ด". Good.
- `2000000` -> "สองล้าน"
- `2100000` -> "สองล้านหนึ่งแสน"? Wait, renderChunk(2100000) is called from the top level since value < 1000000 is false. millions=2, remainder=100000. renderChunk(2) = "สอง". Then "ล้าน". renderChunk(100000): digits=[1,0,0,0,0,0], pos=5 -> "หนึ่งแสน"? Wait, positions array is ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"]. So pos=5 is "แสน". digit=1 -> "หนึ่งแสน". So result: "สองล้านหนึ่งแสน". But standard Thai might omit "หนึ่ง" before "แสน"? Actually no, "หนึ่งแสน" is correct. But wait, in Thai, 100,000 is "หนึ่งแสน" or "แสน"? Usually "หนึ่งแสน". So code seems okay.
- `10` -> "สิบ"
- `20` -> "ยี่สิบ"
- `30` -> "สามสิบ"
- `1000000` boundary: exactly 1 million.

For `countDaysUntilEndOfYear`:
- Dec 31, 2023 -> 0
- Jan 1, 2023 -> 364 (2023 is not leap year: 365-1 = 364)
- Jan 1, 2024 -> 365 (2024 is leap year: 366-1 = 365)
- Feb 29, 2024 -> 306? Let's calculate: from Feb 29 to Dec 31. March (31) + April (30) + May (31) + June (30) + July (31) + August (31) + September (30) + October (31) + November (30) + December (31) = 306. So result should be 306.
- Invalid Date: `new Date('invalid')` -> start and end will be invalid. `end.getTime()` is NaN, difference is NaN, Math.round(NaN) is NaN, Math.max(0, NaN) is NaN. So returns NaN. That's an edge case.
- Date with time component: e.g., new Date(2023, 11, 31, 23, 59, 59) -> should still be 0 because time is stripped.
- Date after end of year? Not possible if same year, but what if we pass Dec 31 2023 with time? Stripped.
- What if baseDate is from a different year? The function uses `baseDate.getFullYear()` for both start and end, so it calculates within that year.

For `renderGeneralSmokeAnswer`:
- `null` -> `String(null || "")` = `""`, trim = `""`, `!/[ก-ฮ]/.test("")` is true -> fallback.
- `undefined` -> same.
- `""` -> same.
- `"   "` -> same.
- `"ping"` -> matches `^(ping|pong|alive|status)$` -> "อยู่ครับ ระบบพร้อมใช้งาน"
- `"PING"` -> case insensitive -> same.
- `"ping "` -> trim makes it "ping", matches.
- `" ping "` -> trim makes it "ping", matches.
- `"pong"` -> matches.
- `"status"` -> matches.
- `"alive"` -> matches.
- `"system online ไหม"` -> matches second status regex.
- `"ชื่ออะไร"` -> matches name regex.
- `"who are you"` -> matches name regex.
- `"what can you do"` -> matches help regex.
- `"help"` -> matches help regex (word boundary).
- `"hello"` -> no Thai chars, no early match -> fallback.
- `"ภาคกลาง"` -> has Thai chars, but does it match `/ภาคกลาง/.test(t) && /จังหวัด|ประกอบ|อะไรบ้าง|กี่/.test(t)`? No, missing second part. So it falls through to truncated part. I should not test this because I don't know the result. But I can test `"ภาคกลาง มีจังหวัดอะไรบ้าง"` which matches.
- `"ภาคตะวันออกเฉียงเหนือ"` -> the regex for ภาคตะวันออก has `!/(เฉียงเหนือ)/.test(t)`, so if input contains เฉียงเหนือ, it won't match ภาคตะวันออก. But it will match ภาค(อีสาน|ตะวันออกเฉียงเหนือ). So edge case: test that ภาคตะวันออกเฉียงเหนือ doesn't return ภาคตะวันออก text.
- `"RAG"` -> matches.
- `"KPI"` -> matches.
- `"OKR"` -> matches.
- `"docker คืออะไร"` -> matches.
- `"machine learning คืออะไร"` -> matches.
- `"ML คืออะไร"` -> matches.
- `"AI คืออะไร"` -> matches.
- `"NASA APOD วันน��้"` -> matches NASA regex.
- `"WorldBank GDP"` -> matches WorldBank regex.
- `"หาดใหญ่ อยู่จังหวัดอะไร"` -> matches.
- `"ภาคใต้ ประกอบด้วยจังหวัดอะไรบ้าง"` -> matches.

Wait, the instruction says "Focus ONLY on edge cases, error handling, boundary conditions, null/empty/malformed inputs, thrown errors, and failure/fallback paths". So I should focus on:
- `renderThaiNumberText`: NaN, Infinity, -Infinity, 0, -0, very large numbers, decimals, numbers with edge digit patterns (11, 21, 101, 1000000, etc.)
- `countDaysUntilEndOfYear`: Invalid Date, Dec 31, Jan 1 (leap/non-leap), time stripping, boundary dates.
- `renderGeneralSmokeAnswer`: null/undefined/empty/whitespace, non-Thai fallback, exact match boundaries for ping/status, case insensitivity, strings that almost match but don't, inputs that bypass early returns and hit fallback or visible branches. Since I can't test the truncated tail, I'll test the visible branches that are clearly defined and the fallback.

Actually, the user says "failure/fallback paths". So for `renderGeneralSmokeAnswer`, testing the `LOW_CONFIDENCE_FALLBACK_TEXT` return for non-Thai text is a fallback path. Also testing that it handles `null`/`undefined` via `String(userText || "")` is an edge case (malformed input).

I need to mock `logBoth` from `../utils/mcpLogger`. The source imports it but never uses it in the visible portion? Actually the source starts with `import { logBoth } from "../utils/mcpLogger";` but I don't see it used in the visible functions. However, I must mock it to satisfy rule 3 and avoid any side effects if it's used in the truncated part or if the module initialization calls it. So I'll mock it.

Structure:
```typescript
import {
  LOW_CONFIDENCE_FALLBACK_TEXT,
  renderGeneralFallbackMessage,
  renderThaiNumberText,
  countDaysUntilEndOfYear,
  renderGeneralSmokeAnswer,
} from '../src/services/generalGate';

jest.mock('../src/utils/mcpLogger', () => ({
  logBoth: jest.fn(),
}));

describe('generalGate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('LOW_CONFIDENCE_FALLBACK_TEXT', () => {
    test('is a non-empty string', () => {
      expect(typeof LOW_CONFIDENCE_FALLBACK_TEXT).toBe('string');
      expect(LOW_CONFIDENCE_FALLBACK_TEXT.length).toBeGreaterThan(0);
    });
  });

  describe('renderGeneralFallbackMessage', () => {
    test('returns a string containing Thai text', () => {
      const result = renderGeneralFallbackMessage();
      expect(typeof result).toBe('string');
      expect(result).toContain('กำลังเรียบเรียง');
    });
  });

  describe('renderThaiNumberText', () => {
    test('returns string representation for NaN', () => {
      expect(renderThaiNumberText(NaN)).toBe('NaN');
    });

    test('returns string representation for Infinity', () => {
      expect(renderThaiNumberText(Infinity)).toBe('Infinity');
    });

    test('returns string representation for -Infinity', () => {
      expect(renderThaiNumberText(-Infinity)).toBe('ลบInfinity');
    });

    test('returns ศูนย์ for 0 and -0', () => {
      expect(renderThaiNumberText(0)).toBe('ศูนย์');
      expect(renderThaiNumberText(-0)).toBe('ศูนย์');
    });

    test('handles decimal truncation via Math.floor', () => {
      expect(renderThaiNumberText(1.9)).toBe('หนึ่ง');
      expect(renderThaiNumberText(-1.9)).toBe('ลบหนึ่ง');
    });

    test('handles edge digit patterns in units', () => {
      expect(renderThaiNumberText(11)).toBe('สิบเอ็ด');
      expect(renderThaiNumberText(21)).toBe('ยี่สิบเอ็ด');
      expect(renderThaiNumberText(101)).toBe('หนึ่งร้อยเอ็ด');
    });

    test('handles millions boundary and remainder', () => {
      expect(renderThaiNumberText(1000000)).toBe('หนึ่งล้าน');
      expect(renderThaiNumberText(1000001)).toBe('หนึ่งล้านหนึ่ง');
      expect(renderThaiNumberText(2000000)).toBe('สองล้าน');
      expect(renderThaiNumberText(2100005)).toBe('สองล้านหนึ่งแสนห้า');
    });

    test('handles ten and twenty edge cases', () => {
      expect(renderThaiNumberText(10)).toBe('สิบ');
      expect(renderThaiNumberText(20)).toBe('ยี่สิบ');
      expect(renderThaiNumberText(30)).toBe('สามสิบ');
    });
  });

  describe('countDaysUntilEndOfYear', () => {
    test('returns 0 for December 31', () => {
      expect(countDaysUntilEndOfYear(new Date(2023, 11, 31))).toBe(0);
    });

    test('returns correct count for Jan 1 non-leap year', () => {
      expect(countDaysUntilEndOfYear(new Date(2023, 0, 1))).toBe(364);
    });

    test('returns correct count for Jan 1 leap year', () => {
      expect(countDaysUntilEndOfYear(new Date(2024, 0, 1))).toBe(365);
    });

    test('returns correct count for Feb 29 leap year', () => {
      expect(countDaysUntilEndOfYear(new Date(2024, 1, 29))).toBe(306);
    });

    test('ignores time component by stripping to midnight', () => {
      expect(countDaysUntilEndOfYear(new Date(2023, 11, 31, 23, 59, 59))).toBe(0);
    });

    test('returns NaN for invalid Date input', () => {
      expect(countDaysUntilEndOfYear(new Date('invalid'))).toBeNaN();
    });
  });

  describe('renderGeneralSmokeAnswer', () => {
    test('returns fallback for null input', () => {
      expect(renderGeneralSmokeAnswer(null as any)).toBe(LOW_CONFIDENCE_FALLBACK_TEXT);
    });

    test('returns fallback for undefined input', () => {
      expect(renderGeneralSmokeAnswer(undefined as any)).toBe(LOW_CONFIDENCE_FALLBACK_TEXT);
    });

    test('returns fallback for empty or whitespace-only string', () => {
      expect(renderGeneralSmokeAnswer('')).toBe(LOW_CONFIDENCE_FALLBACK_TEXT);
      expect(renderGeneralSmokeAnswer('   ')).toBe(LOW_CONFIDENCE_FALLBACK_TEXT);
    });

    test('returns fallback for non-Thai text without early match', () => {
      expect(renderGeneralSmokeAnswer('hello world')).toBe(LOW_CONFIDENCE_FALLBACK_TEXT);
    });

    test('matches exact ping/pong/alive/status case-insensitively', () => {
      expect(renderGeneralSmokeAnswer('ping')).toBe('อยู่ครับ ระบบพร้อมใช้งาน');
      expect(renderGeneralSmokeAnswer('PING')).toBe('อยู่ครับ ระบบพร้อมใช้งาน');
      expect(renderGeneralSmokeAnswer('pong')).toBe('อยู่ครับ ระบบพร้อมใช้งาน');
      expect(renderGeneralSmokeAnswer('alive')).toBe('อยู่ครับ ระบบพร้อมใช้งาน');
      expect(renderGeneralSmokeAnswer('status')).toBe('อยู่ครับ ระบบพร้อมใช้งาน');
    });

    test('does not match ping-like phrases with extra words', () => {
      // "ping now" should not match ^(ping|...)$ but might match the broader status regex?
      // The broader regex requires Thai status words. So English-only "ping now" should fallback.
      expect(renderGeneralSmokeAnswer('ping now')).toBe(LOW_CONFIDENCE_FALLBACK_TEXT);
    });

    test('matches status inquiry with Thai keywords', () => {
      expect(renderGeneralSmokeAnswer('ระบบพร้อมใช้งานไหม')).toBe('อยู่ครับ ระบบพร้อมใช้งาน');
    });

    test('matches name inquiry case-insensitively', () => {
      expect(renderGeneralSmokeAnswer('who are you')).toContain('Innova-bot');
      expect(renderGeneralSmokeAnswer('ชื่ออะไร')).toContain('Innova-bot');
    });

    test('matches help inquiry with word boundary', () => {
      expect(renderGeneralSmokeAnswer('help')).toContain('weather');
      expect(renderGeneralSmokeAnswer('what can you do')).toContain('weather');
      expect(renderGeneralSmokeAnswer('ทำอะไรได้')).toContain('weather');
    });

    test('does not match help substring without word boundary where required', () => {
      // "helpful" contains "help" but \bhelp\b should not match? Actually "helpful" has "help" followed by "ful", so \b is between p and f? No, \b is between word char and non-word char. "helpful": h-e-l-p-f-u-l. p is word char, f is word char, so no boundary between them. So \bhelp\b won't match "helpful".
      expect(renderGeneralSmokeAnswer('helpful')).toBe(LOW_CONFIDENCE_FALLBACK_TEXT);
    });

    test('matches visible Thai region branches', () => {
      expect(renderGeneralSmokeAnswer('ภาคกลาง มีจังหวัดอะไรบ้าง')).toContain('กรุงเทพมหานคร');
      expect(renderGeneralSmokeAnswer('ภาคเหนือ ประกอบด้วย')).toContain('เชียงใหม่');
      expect(renderGeneralSmokeAnswer('ภาคอีสาน มีจังหวัดอะไรบ้าง')).toContain('นครราชสีมา');
      expect(renderGeneralSmokeAnswer('ภาคตะวันออกเฉียงเหนือ มีกี่จังหวัด')).toContain('นครราชสีมา');
      expect(renderGeneralSmokeAnswer('ภาคใต้ ประกอบด้วย')).toContain('ภูเก็ต');
      expect(renderGeneralSmokeAnswer('ภาคตะวันออก มีจังหวัดอะไรบ้าง')).toContain('ชลบุรี');
    });

    test('does not misclassify ภาคตะวันออกเฉียงเหนือ as ภาคตะวันออก', () => {
      const result = renderGeneralSmokeAnswer('ภาคตะวันออกเฉียงเหนือ มีจังหวัดอะไรบ้าง');
      // Should match the อีสาน branch, not the ตะวันออก branch
      expect(result).toContain('นครราชสีมา');
      expect(result).not.toContain('ชลบุรี');
    });

    test('matches specific knowledge branches', () => {
      expect(renderGeneralSmokeAnswer('หาดใหญ่ อยู่จังหวัดอะไร')).toContain('สงขลา');
      expect(renderGeneralSmokeAnswer('NASA APOD วันนี้')).toContain('Astronomy Picture');
      expect(renderGeneralSmokeAnswer('WorldBank GDP')).toContain('World Bank');
      expect(renderGeneralSmokeAnswer('RAG')).toContain('ค้น/ดึงข้อมูล');
      expect(renderGeneralSmokeAnswer('AI คืออะไร')).toContain('เทคโนโลยี');
      expect(renderGeneralSmokeAnswer('KPI')).toContain('Key Performance Indicator');
      expect(renderGeneralSmokeAnswer('OKR')).toContain('Objectives');
      expect(renderGeneralSmokeAnswer('docker คืออะไร')).toContain('container');
      expect(renderGeneralSmokeAnswer('machine learning คืออะไร')).toContain('แมชชีนเลิร์นนิง');
      expect(renderGeneralSmokeAnswer('ML คืออะไร')).toContain('แมชชีนเลิร์นนิง');
    });

    test('matches short-answer request exactly', () => {
      expect(renderGeneralSmokeAnswer('ตอบสั้นคำเดียวว่าพร้อมใช้งาน')).toBe('พร้อมใช้งาน');
    });
  });
});
```

Wait, I need to check the exact return values for some of these to make sure they match the source.

- `renderGeneralSmokeAnswer('who are you')`: The regex is `/(ชื่ออะไร|คือใคร|เป็นใคร|who are you|what is your name|what are you|are you)/i`. So "who are you" matches. Return: `"สวัสดีครับ ผมชื่อ Innova-bot เป็น AI ผู้ช่วยสำหรับระบบ InnoMCP ยินดีให้บริการครับ"`. My test uses `.toContain('Innova-bot')` which is fine.

- `renderGeneralSmokeAnswer('help')`: regex includes `\bhelp\b`. Return contains "weather"? Yes: `"ระบบนี้ช่วยได้หลายเรื่องครับ เช่น พยากรณ์อากาศ (weather), ..."`. So `.toContain('weather')` works.

- `renderGeneralSmokeAnswer('helpful')`: The regex `\bhelp\b` won't match "helpful" because there's no word boundary between 'p' and 'f'. So it falls through. Since it has no Thai chars, it will hit `!/[ก-ฮ]/.test(t)` and return fallback. Good.

- `renderGeneralSmokeAnswer('ping now')`: The exact match regex `^(ping|pong|alive|status)$` won't match. The broader status regex requires Thai words or specific English words like "online ไหม", "alive", "ping", "status" but combined with other system words. Let's look: `(/(ระบบ|backend|back\s*end|server|เซิร์ฟเวอร์|system|สถานะ|online|alive|พร้อมใช้งาน)/i.test(t) && /(พร้อมใช้งานไหม|...|online\s*ไหม|alive|ping|status)/i.test(t))`. For "ping now": first part tests for system words: none. Second part tests for status words: "ping" is in the second regex. But it's AND, so both must match. First part doesn't match. So it falls through. No Thai chars -> fallback. Good.

- `renderGeneralSmokeAnswer('ระบบพร้อมใช้งานไหม')`: First regex: contains "ระบบ" (matches first part) and "พร้อมใช้งานไหม" (matches second part). So returns "อยู่ครับ ระบบพร้อมใช้งาน". Good.

- `renderGeneralSmokeAnswer('ภาคตะวันออกเฉียงเหนือ มีจังหวัดอะไรบ้าง')`: The regex for ภาคตะวันออก has `!/(เฉียงเหนือ)/.test(t)`. Since input contains "เฉียงเหนือ", this branch is skipped. Then the next visible branch is ภาค(อีสาน|ตะวันออกเฉียงเหนือ) which matches. So returns the อีสาน text. Good.

- `renderGeneralSmokeAnswer('ตอบสั้นคำเดียวว่าพร้อมใช้งาน')`: The regex `/(ตอบ(?:สั้น|สั้นๆ|สั้น ๆ)?(?:แค่)?คำเดียว(?:ว่า)?\s*(พร้อมใช้งาน|พร้อม|online|ใช้งานได้))/i` should match. Return is "พร้อมใช้งาน". Good.

- `renderThaiNumberText(1.9)`: `!Number.isFinite(1.9)` is false. `value === 0` false. `value
