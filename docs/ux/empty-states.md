# UX Spec: Empty State Components for `innomcp`

## Problem
Users encounter blank screens or confusing “no data” states when chat transcripts are cleared, leaderboard filters yield zero agents, workspace contains no files, or memory list is empty. Current UI lacks guidance, causing frustration and disengagement.

## Proposed Solution
Define reusable empty-state components with contextual icon, Thai headline, and a helpful CTA (button/link). Each state maps to a specific page/module. Implementation via shared component under `components/chat/`.

## Component-Level Changes

**New file:** `innomcp-next/src/app/components/chat/EmptyState.tsx`  
Props: `icon`, `headline` (string, Thai+English fallback), `cta` (object: label, action). Supporting types in same file.

**Existing files to update:**
- `chat/transcript-area.tsx` – import and render EmptyState when `messages.length === 0`.
- `leaderboard/leaderboard.tsx` – render EmptyState when filtered agents array empty.
- `workspace/file-list.tsx` – render EmptyState when no workspace files found.
- `memory/memory-list.tsx` – render EmptyState when memories empty.

**Localization:** Thai headlines stored in a locale map (e.g., `th.json`). English fallback hardcoded in component.

## Empty State Details (Icon, Thai Headline, CTA)

| Context | Icon | Thai Headline | CTA (Thai/English) |
|---------|------|---------------|-------------------|
| Empty chat transcript | `💬` | “ยังไม่มีข้อความ” (No messages yet) | “เริ่มสนทนา / Start Chat” → opens new chat |
| No agents in leaderboard filter | `🏆` (faded) | “ไม่พบเอเจนต์ตามตัวกรอง” (No agents match filter) | “ล้างตัวกรอง / Clear Filters” → resets filter |
| No workspace files | `📁` (open empty) | “ยังไม่มีไฟล์ในเวิร์กสเปซ” (No workspace files) | “อัปโหลดไฟล์ / Upload File” → triggers upload dialog |
| No memories | `🧠` (outline) | “ยังไม่มีความทรงจำ” (No memories) | “สร้างความทรงจำ / Create Memory” → opens memory creator |

## Acceptance Criteria

1. All four empty states display correct icon, Thai headline, and CTA as per table.
2. CTA performs intended action (e.g., navigates, opens modal, clears filter).
3. State appears immediately when data is empty (no loading flash).
4. For Thai locale (`th`), Thai headline shown; for `en`, English fallback shown.
5. Component works in both `/living-chat` and `/dashboard` contexts.

## Edge Cases

- **Filtered leaderboard with zero results after removing filter:** CTA should clear filter and restore full list.
- **User without permission to upload workspace files:** CTA hidden or replaced with “ติดต่อผู้ดูแล / Contact Admin”.
- **Empty chat transcript on first load:** Show state instead of blank area; “Start Chat” triggers new conversation.
- **Memory list empty after deletion:** State shows with correct icon; no stale data.
- **Very long headlines:** Handle via `text-ellipsis` or max-width with tooltip.
- **Icon accessibility:** Add `role="img"` with `aria-label` in Thai and English.
