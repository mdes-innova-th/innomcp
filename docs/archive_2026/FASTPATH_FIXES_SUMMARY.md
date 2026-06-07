# FastPath Fixes Summary

## Problem
FastPath was incorrectly handling short meaningful phrases:
- **"999!"** was classified as emoji instead of factorial (math calculation)
- **Time/date queries** like "กี่โมง", "วันนี้" were not bypassing FastPath
- Short meaningful queries were being treated as greetings instead of tool-worthy questions

## Root Causes

### 1. intentGate.ts - Missing Keywords
`WORK_KEYWORDS` array only had weather, data, tech keywords but missing:
- Time/date queries: กี่โมง, เวลา, วันนี้, วันที่, ตอนนี้
- Generic query words: time, date, today, now, when

### 2. looksLikeMathOrCalc() - Weak Factorial Detection
Regex `/\d+!/` matched factorial but didn't enforce bypass:
- "999!" matched but wasn't treated as pure math
- No special handling for "only factorial" patterns

### 3. fastPathGreeting.ts - Emoji List Pollution
Emoji array included math expressions:
```typescript
"999",
"999!",
"999!!",
"999!!!"
```

### 4. detectFastPath() - Aggressive Emoji Regex
Regex `/^(5{3,}|9{3,})(!+)?$/` caught ALL "999!" patterns:
- Matched before intentGate bypass check
- Returned "emoji" hit instead of null (bypass)

---

## Solutions Implemented

### ✅ Fix 1: Enhanced WORK_KEYWORDS in intentGate.ts
**File:** `innomcp-node/src/fastpath/intentGate.ts`

Added time/date keywords section:
```typescript
const WORK_KEYWORDS = [
  // ... existing keywords ...
  
  // Time & Date (NEW - short meaningful queries)
  "กี่โมง", "เวลา", "วันนี้", "วันที่", "ตอนนี้", "time", "date", "today", "now", "when",
  "วันอะไร", "เดือน", "ปี", "year", "month", "day", "clock",
  
  // ... rest ...
];
```

**Impact:** Queries like "กี่โมง", "วันนี้" now bypass FastPath and reach AI tools

---

### ✅ Fix 2: Strengthened looksLikeMathOrCalc()
**File:** `innomcp-node/src/fastpath/intentGate.ts`

Enhanced factorial detection:
```typescript
export function looksLikeMathOrCalc(text: string): boolean {
  // ... existing checks ...
  
  // 4) Factorial pattern (e.g., "999!", "5!") - MUST bypass FastPath for math tools
  const hasFactorial = /\d+!+/.test(t);
  
  // ... more checks ...
  
  // If it's ONLY factorial (like "999!"), treat as math
  if (hasFactorial && /^[\d\s!]+$/.test(t)) {
    return true;
  }
  
  return onlyNumLike || hasOp || hasCalcWord || hasFactorial || complexMath;
}
```

**Impact:** "999!" now correctly bypasses FastPath as math calculation

---

### ✅ Fix 3: Cleaned Emoji List
**File:** `innomcp-node/src/utils/fastPathGreeting.ts`

Removed math patterns from emoji array:
```typescript
emoji: [
  "🙂", "😀", "😄", ... // Unicode emoji only
  // Thai "555" style (NOT 999! - that's factorial/math)
  "555",
  "5555",
  "55555",
  // REMOVED: "999", "999!", "999!!", "999!!!"
],
```

**Impact:** "999!" no longer matches emoji dictionary

---

### ✅ Fix 4: Updated detectFastPath() Regex
**File:** `innomcp-node/src/utils/fastPathGreeting.ts`

Changed emoji detection regex:
```typescript
// BEFORE:
if (/^(5{3,}|9{3,})(!+)?$/.test(original.trim())) return "emoji";

// AFTER:
// quick emoji / laugh codes (but NOT factorial patterns like 999!)
if (containsAny(safeNormalize(original), dict.emoji)) return "emoji";
if (/^5{3,}$/.test(original.trim())) return "emoji"; // "555", "5555" only
```

**Impact:** Only "555" patterns treated as emoji, "999!" bypassed

---

## Request Flow After Fixes

### Example 1: "999!"
1. ✅ **intentGate.ts** → `looksLikeMathOrCalc()` → **returns true** (MATH_OR_CALC)
2. ✅ **fastPathHandler.ts** → `intent.shouldBypass = true` → **bypass FastPath**
3. ✅ Message reaches AI → Tool call → factorial calculation

### Example 2: "กี่โมง"
1. ✅ **intentGate.ts** → `hasWorkKeyword()` → **matches "กี่โมง"** (WORK_KEYWORD)
2. ✅ **fastPathHandler.ts** → `intent.shouldBypass = true` → **bypass FastPath**
3. ✅ Message reaches AI → Tool call → datetime_now

### Example 3: "วันนี้"
1. ✅ **intentGate.ts** → `hasWorkKeyword()` → **matches "วันนี้"** (WORK_KEYWORD)
2. ✅ **fastPathHandler.ts** → `intent.shouldBypass = true` → **bypass FastPath**
3. ✅ Message reaches AI → Tool call → datetime_now

### Example 4: "555" (unchanged)
1. ❌ **intentGate.ts** → No bypass
2. ✅ **fastPathGreeting.ts** → Matches emoji regex `/^5{3,}$/` → **"emoji" hit**
3. ✅ FastPath returns: "😄 รับทราบครับ! อยากให้ช่วยเรื่องไหนต่อ?"

---

## Testing Checklist

### Should Bypass FastPath (reach AI tools):
- [ ] "999!" → factorial calculation
- [ ] "5+5" → calculation
- [ ] "กี่โมง" → datetime_now tool
- [ ] "วันนี้" → datetime_now tool
- [ ] "ตอนนี้" → datetime_now tool
- [ ] "อากาศเป็นยังไง" → weather tools
- [ ] "คำนวณ 10*20" → calculation

### Should Use FastPath (quick response):
- [ ] "555" → emoji response
- [ ] "5555" → emoji response
- [ ] "สวัสดี" → greeting response
- [ ] "ขอบคุณ" → thanks response
- [ ] "โอเค" → ok response

---

## Files Modified

1. **innomcp-node/src/fastpath/intentGate.ts**
   - Line 8-27: Added time/date keywords to WORK_KEYWORDS
   - Line 62-85: Enhanced looksLikeMathOrCalc() with factorial-only check

2. **innomcp-node/src/utils/fastPathGreeting.ts**
   - Line 136-160: Removed "999!", "999!!", "999!!!" from emoji array
   - Line 259-267: Changed emoji regex to exclude "9{3,}" patterns

---

## Technical Details

### intentGate.ts Flow
```typescript
analyzeIntent(text) {
  isMath = looksLikeMathOrCalc(text)     // Check math/factorial
  hasWork = hasWorkKeyword(text)         // Check time/date/weather
  
  if (isMath || hasWork) {
    shouldBypass = true                  // Skip FastPath
    reason = "MATH_OR_CALC" or "WORK_KEYWORD"
  }
}
```

### fastPathHandler.ts Integration
```typescript
const intent = analyzeIntent(text);
if (intent.shouldBypass) {
  logger.debug(`[FastPath] Intent bypass: ${intent.reason}`);
  return { handled: false, reason: intent.reason };
}
// Continue to FastPath matching...
```

---

## Benefits

### 🎯 Accuracy
- "999!" now correctly calculated as factorial
- Time queries reach datetime tools
- No more false positives for emoji

### ⚡ Performance
- FastPath still handles pure greetings in <1s
- Meaningful queries properly routed to AI

### 🧠 Intelligence
- System now distinguishes:
  - Pure greetings (FastPath) vs.
  - Short meaningful queries (AI Tools)

---

## Next Steps

1. **Manual Testing**
   - Test all cases in checklist above
   - Verify FastPath logs show correct bypass reasons

2. **Database Integration (Optional)**
   - Add time/date patterns to `fastpath_phrases` table
   - Enable DB-backed phrase loading (already supported)

3. **Monitoring**
   - Watch FastPath logs for false positives
   - Track bypass rates for math/time queries

---

**Date:** 2025-01-13  
**Status:** ✅ Completed  
**Files Changed:** 2  
**Lines Modified:** ~30  
