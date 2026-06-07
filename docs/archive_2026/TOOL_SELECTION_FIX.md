# Tool Selection Fix - TODO List

## 🐛 Issues Found

1. **Greetings trigger tool selection**: "สวัสดี" bypasses greeting detection
2. **Irrelevant tools selected**: Calculator selected for non-math queries
3. **Tool filtering loops**: Multiple filtering passes on same data
4. **Low threshold allows irrelevant matches**: Fuse.js threshold 0.4 too permissive
5. **No explicit greeting short-circuit**: `isGreetingQuery()` exists but not used early enough

## ✅ TODO Items (Fix in Order)

### TODO 1: Fix Greeting Detection in classifyMessageType()
**File**: `innomcp-node/src/utils/mcp/mcpclient.ts`
**Line**: ~2070 (quickClassifyMessage method)
**Issue**: Greeting detection happens AFTER action request detection
**Fix**: Move greeting check to TOP of quickClassifyMessage()
**Test**: "สวัสดี" should return `{type: "greeting", canAnswerDirectly: true}`

### TODO 2: Add Early Exit for Greetings in selectTools()
**File**: `innomcp-node/src/utils/mcp/mcpclient.ts`
**Line**: ~2303 (selectTools method)
**Issue**: No early exit when isGreetingQuery() returns true
**Fix**: Add at start of selectTools():
```typescript
// Skip tool selection for greetings
if (this.isGreetingQuery(userMessage)) {
  console.log('[MCP Client] 👋 Greeting detected - skipping tool selection');
  return [];
}
```
**Test**: "สวัสดี" should NOT select any tools

### TODO 3: Strengthen Calculator Blacklist
**File**: `innomcp-node/src/utils/mcp/mcpclient.ts`
**Line**: ~2245 (scoreToolRelevance method)
**Issue**: Calculator check too permissive
**Fix**: Require BOTH numbers AND (math symbols OR keywords):
```typescript
if (toolName.includes('calculator')) {
  const hasNumbers = /\d/.test(userMessage);
  const hasMathSymbols = /[\+\-\*\/\×\÷\^=]/.test(userMessage);
  const hasFactorial = /\d+!/.test(userMessage);
  const hasMathKeywords = /(?:คำนวณ|หาร|คูณ|บวก|ลบ|ยกกำลัง|factorial|calculate|compute)/i.test(userMessage);
  
  // STRICT: Must have numbers AND (symbols OR keywords)
  const isValidMath = hasNumbers && (hasMathSymbols || hasFactorial || hasMathKeywords);
  
  if (!isValidMath) {
    console.log(`[Score] ${toolName} BLACKLISTED: No valid math expression`);
    return 0;
  }
}
```
**Test**: "สวัสดี 123" should NOT select calculator (has numbers but no math operation)

### TODO 4: Reduce Fuse.js Threshold (Stricter Matching)
**File**: `innomcp-node/src/utils/mcp/mcpclient.ts`
**Line**: Multiple locations using Fuse.js
**Issue**: Threshold 0.4 allows too many false matches
**Fix**: Change threshold from 0.4 to 0.3 in:
- tryKeywordMatching() line ~2487
- scoreToolRelevance() (if using Fuse directly)
**Test**: "สวัสดี" should not fuzzy-match math/calculator keywords

### TODO 5: Add Minimum Score Threshold in selectTools()
**File**: `innomcp-node/src/utils/mcp/mcpclient.ts`
**Line**: ~2303 (selectTools method)
**Issue**: Tools with very low scores still get selected
**Fix**: Filter candidates with score < 20 before final selection
```typescript
const finalSelection = candidates
  .filter((toolName) => {
    const tool = this.tools.get(toolName);
    const resource = this.resources.get(toolName);
    return tool || resource;
  })
  .slice(0, 3);
```
**Test**: Verify only highly relevant tools selected

### TODO 6: Remove Duplicate Pattern Matching
**File**: `innomcp-node/src/utils/mcp/mcpclient.ts`
**Line**: ~2403 (tryPatternMatching method)
**Issue**: Matches same tool multiple times with different patterns
**Fix**: Track matched tools in Set to prevent duplicates:
```typescript
const matchedToolsSet = new Set<string>();
// ... in loop
allMatches.forEach((tool) => {
  matchedToolsSet.add(tool);
  const current = toolScores.get(tool) || 0;
  toolScores.set(tool, current + score);
});
```
**Test**: Verify no duplicate logging for same tool

### TODO 7: Fix DateTime Blacklist Pattern
**File**: `innomcp-node/src/utils/mcp/mcpclient.ts`
**Line**: ~2260 (scoreToolRelevance method)
**Issue**: DateTime blacklist too strict, might reject valid queries
**Fix**: Improve datetime keyword detection:
```typescript
if (toolName.includes('dateTime')) {
  const hasDateTimeKeywords = /(?:กี่โมง|เวลา|วันที่|วันนี้|พรุ่งนี้|เมื่อวาน|ตอนนี้|เดี๋ยวนี้|ปัจจุบัน|time|date|today|now|taskbar)/i.test(userMessage);
  if (!hasDateTimeKeywords) {
    console.log(`[Score] ${toolName} BLACKLISTED: No datetime keywords`);
    return 0;
  }
}
```
**Test**: "ตอนนี้กี่โมง" should select dateTimeTool

### TODO 8: Add Logging for Score Filtering
**File**: `innomcp-node/src/utils/mcp/mcpclient.ts`
**Line**: Throughout selectTools() method
**Issue**: Hard to debug why tools are/aren't selected
**Fix**: Add detailed logging:
```typescript
console.log(`[Tool Selection] Scoring ${toolName}:`);
console.log(`  - TF-IDF: ${tfidfScore.toFixed(2)}`);
console.log(`  - Fuse: ${fuseScore.toFixed(2)}`);
console.log(`  - Category: ${categoryScore}`);
console.log(`  - Total: ${totalScore.toFixed(2)}`);
console.log(`  - Threshold: ${MINIMUM_SCORE_THRESHOLD}`);
console.log(`  - Selected: ${totalScore >= MINIMUM_SCORE_THRESHOLD ? '✅' : '❌'}`);
```
**Test**: Check logs show why each tool was accepted/rejected

### TODO 9: Add Test Suite for 10 Questions
**File**: Create `tests/test-tool-intelligence.bat`
**Issue**: Need automated testing for tool selection
**Fix**: Create batch file testing 10 different scenarios
**Test**: All 10 tests should select correct tools

### TODO 10: Performance - Cache Greeting Detection
**File**: `innomcp-node/src/utils/mcp/mcpclient.ts`
**Line**: Add to class properties
**Issue**: Greeting regex runs multiple times for same query
**Fix**: Add greeting cache:
```typescript
private greetingCache = new Map<string, boolean>();
```
**Test**: Verify faster response on repeated greetings

## 📋 Test Plan

After each TODO is completed, run:
1. `cd tests && quick-test.bat` (verify existing tests still pass)
2. Manual test: Send "สวัสดี" in chat → Should get friendly response WITHOUT tool selection
3. Check logs for:
   - ✅ Greeting detected message
   - ✅ No tool selection logs
   - ✅ No calculator/math tool execution

## 🎯 Success Criteria

1. "สวัสดี" → Friendly greeting response (NO tools)
2. "123+456" → Calculator tool ONLY
3. "ตอนนี้กี่โมง" → DateTime tool ONLY
4. "อากาศวันนี้" → Weather tool ONLY
5. "สวัสดี 123" → Greeting response (NO calculator despite numbers)
6. Logs show clear filtering decisions
7. No duplicate tool selections
8. No irrelevant tools selected
9. Fast response (<500ms for tool selection)
10. All 10 test questions select correct tools

## 📊 Current Status

- [x] TODO 1: Fix Greeting Detection ✅ COMPLETED
- [x] TODO 2: Early Exit for Greetings ✅ COMPLETED
- [x] TODO 3: Strengthen Calculator Blacklist ✅ COMPLETED
- [x] TODO 4: Reduce Fuse.js Threshold ✅ COMPLETED
- [x] TODO 5: Add Minimum Score Threshold ✅ COMPLETED
- [ ] TODO 6: Remove Duplicate Pattern Matching (SKIP - not critical)
- [x] TODO 7: Fix DateTime Blacklist ✅ COMPLETED
- [x] TODO 8: Add Logging ✅ COMPLETED
- [x] TODO 9: Create Test Suite ✅ COMPLETED
- [ ] TODO 10: Performance Optimization (SKIP for now - implement if needed)

---

**Start Time**: 2025-06-23 00:50
**Current Time**: 2025-06-23 01:00
**Status**: 8/10 TODOs completed (2 skipped as non-critical)
**Next Step**: Test the fixes with manual greeting + run test-tool-intelligence.bat
