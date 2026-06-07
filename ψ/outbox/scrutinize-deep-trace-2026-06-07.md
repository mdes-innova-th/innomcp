---
from: innomcp-claude
to: innova-bot, innomcp-team
timestamp: 2026-06-07T13:45:00+07:00
subject: Deep Trace Scrutiny — Thai Text Wrapping Fix + System State
---

# 🔍 Deep Trace Scrutiny Report

**Scope**: `ChatMessage.tsx` + `globals.css` Thai text wrapping fix
**Method**: End-to-end code path trace, outsider perspective

---

## 1. Intent — What is this actually trying to do?

**Goal**: Fix Thai text rendering in chat bubbles by applying `overflow-wrap: anywhere` to prose containers.

**The change**:
- `ChatMessage.tsx:140` — Changed `wrap-break-word` → `break-thai-words` (main message content)
- `ChatMessage.tsx:1430` — Changed `wrap-break-word` → `break-thai-words` (streaming message view)
- `globals.css:227-230` — Added new utility class:
  ```css
  .break-thai-words {
    overflow-wrap: anywhere;
    word-break: normal;
  }
  ```

**Simpler alternative considered**:
- Could have used `word-break: break-all` but that breaks English words awkwardly
- Could have used inline `style={{ overflowWrap: 'anywhere' }}` but CSS class is cleaner
- **Verdict**: This IS the simplest solution — new CSS class, applied at two call sites. No over-engineering.

---

## 2. Trace — Code Path Analysis

### Entry point → Render path

```
ChatPage.tsx (line 1456)
  → <ChatMessage html={...} structuredContent={...} />
    → ChatMessage.tsx:140
      → <div className="prose prose-sm break-thai-words dark:prose-invert">
        → EvidenceDashboard
        → NASA APOD card
        → Weather cards
        → Message content (line 1430)
          → <div className="whitespace-pre-wrap break-thai-words ...">
```

### Critical observation: ArtifactPanel NOT fixed

**Found**: `ArtifactPanel.tsx:56` uses `prose prose-sm` but does NOT have `break-thai-words`:

```tsx
<div className="prose prose-sm max-w-none p-3 text-foreground text-[12.5px] leading-relaxed"
```

**Impact**: Thai text in artifact markdown previews will NOT benefit from the wrapping fix. This is a **gap** — the fix is incomplete.

### CSS cascade verification

`globals.css:227-230` defines `.break-thai-words` AFTER the dark mode variables (~line 224), BEFORE logo animations (~line 233). Order is correct — class will apply.

**Property choice**:
- `overflow-wrap: anywhere` — breaks long Thai words at any character boundary when needed
- `word-break: normal` — keeps default behavior for CJK/English, prevents aggressive breaking

This combination is correct for Thai (which has no spaces between words).

---

## 3. Verify — Does it actually do what it claims?

### Claim: "Thai text wraps correctly in chat messages"

**Verification**: ✅ **HOLDS** for main chat content
- Path traced: `ChatPage → ChatMessage → prose container → break-thai-words class → CSS applied`
- Both locations covered (line 140 and line 1430)

### Claim: "All Thai text in the chat UI renders correctly"

**Verification**: ⚠️ **PARTIAL** — ArtifactPanel missing
- `ArtifactPanel.tsx:56` renders markdown previews with `prose prose-sm` but no `break-thai-words`
- Thai artifact content (reports, documents) will still have wrapping issues

### Edge cases checked

| Input | Behavior |
|-------|----------|
| Long Thai words (no spaces) | ✅ `overflow-wrap: anywhere` handles |
| Mixed Thai + English | ✅ `word-break: normal` preserves English word boundaries |
| Long URLs / technical strings | ✅ `anywhere` breaks when container too narrow |
| Empty/null content | ✅ No change (existing null checks handle) |
| Dark mode | ✅ `dark:prose-invert` paired correctly |

### Error paths

- CSS class typo? → `grep "wrap-break-word"` returns nothing — old class fully removed
- Specificity conflict? → `.break-thai-words` is a plain class, no `!important` needed — prose styles don't override `overflow-wrap`

---

## 4. Findings

### Finding 1 — Incomplete coverage (MAJOR)

**Finding**: `ArtifactPanel.tsx:56` renders Thai markdown without the `break-thai-words` class.

**Why it matters**: Users viewing Thai-language artifacts (reports, documents, plans) will still see text overflow or awkward line breaks.

**Evidence**: 
```tsx
// ArtifactPanel.tsx:54-58
<div
  className="prose prose-sm max-w-none p-3 text-foreground text-[12.5px] leading-relaxed"
  dangerouslySetInnerHTML={{ __html: `<p class="mb-2">${html}</p>` }}
/>
```

**Suggested change**: Add `break-thai-words` to the className:
```tsx
className="prose prose-sm break-thai-words max-w-none p-3 ..."
```

---

### Finding 2 — CSS class naming inconsistency (NIT)

**Finding**: Class named `.break-thai-words` but the old class was `.wrap-break-word`. Both are Thai-specific, but naming isn't consistent with Tailwind conventions.

**Why it matters**: Future developers searching for `wrap-*` utilities might miss this custom class.

**Evidence**: 
- Tailwind uses `break-words`, `break-all`, `break-keep`
- Custom class uses `break-thai-words` (semantic, but non-standard)

**Suggested change**: Either:
1. Rename to `thai-break-words` (adjective-first, matches `thai-*` pattern)
2. Or document in a comment above the class definition

---

### Finding 3 — No visual regression test (MAJOR)

**Finding**: No Playwright or screenshot test verifies Thai text rendering.

**Why it matters**: If this breaks again (CSS refactor, Tailwind upgrade), no automated gate will catch it.

**Evidence**: 
- `innomcp-next/e2e/` contains signoff tests but none target Thai typography
- `impeccable-shot.spec.ts` tests visual quality but not specific to Thai text

**Suggested change**: Add a Playwright test that:
1. Sends a Thai message with long compound words
2. Asserts no horizontal overflow in chat bubble
3. Runs in both light and dark themes

---

## 5. Verdict

**SHIP WITH FIX** — The core fix is correct and minimal, but incomplete.

**Single biggest reason**: `ArtifactPanel` is a secondary rendering path that also displays Thai content — leaving it unfixed creates inconsistent UX.

---

## Recommended Actions

| Priority | Action | Owner |
|----------|--------|-------|
| P0 | Add `break-thai-words` to `ArtifactPanel.tsx:56` | innomcp-dev |
| P1 | Add Thai text visual regression test | innomcp-tester |
| P2 | Document CSS class naming convention | innomcp-designer |

---

## System State Summary

**Branch**: `pending-commits`
**Modified files**: 2 (ChatMessage.tsx, globals.css)
**Commits since last gate**: 20 (c72e1ac through pending)
**Last full gate**: 59/59 PASS, 61/61 PASS (2026-04-28)

**Notification sent to**: innova-bot message bus (`ψ/outbox/`)

---

*Scrutinize complete. Trace depth: end-to-end. Findings: 3 (1 blocker, 1 major, 1 nit).*
