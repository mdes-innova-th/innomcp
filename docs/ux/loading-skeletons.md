# UX Spec: Loading Skeletons for innomcp

## Problem
Bare "Loading…" text (e.g., Agent Leaderboard: "Loading… · Refreshing in 26s") and similar fallback strings increase perceived latency and feel unfinished. Users may think the app is stuck. Thai/English mix exacerbates inconsistency.

## Proposed Solution
Replace all text-based loading states with skeleton placeholders that mirror final layout dimensions, animations (pulse/shimmer), and support both Thai and English. Skeletons appear immediately on route/navigation start and disappear when data is ready.

## Component-Level Changes (files under `innomcp-next/src/app/components/`)

| Component | File(s) | Changes |
|-----------|---------|---------|
| Agent Leaderboard | `chat/AgentLeaderboard.tsx` (or `chat/Leaderboard.tsx`) | Replace `"Loading… · Refreshing in 26s"` with a skeleton row list: 5–7 rounded rectangles per row (avatar, name, score) with pulse animation. |
| Chat Messages | `chat/ChatMessages.tsx` | Replace current loading text with a skeleton conversation: alternating left/right message bubbles (square + 2 line blocks). |
| Login / LoginCard | `LoginCard.tsx` (in `../auth/`) | Skeleton for avatar + 2 input fields + button. |
| Dashboard Stats | `DashboardStats.tsx` (in `../dashboard/`) | Skeleton grid of 4 stat cards with title-line + number-rectangle. |
| Onboarding Modal | `OnboardingModal.tsx` (in `../chat/` or `../ui/`) | Skeleton placeholder for modal content (illustration + 3 lines) until step data loads. Ensure "ข้าม" (skip) button remains visible. |

> All skeletons respect `lang` attribute for Thai (th) vs English (en) – i.e., no hard-coded text inside skeleton.

## Acceptance Criteria
1. No bare "Loading…" or equivalent text strings exist in any of the above components.
2. Skeletons are visible within 100ms of initiating a fetch/route change (use `isLoading` state or Next.js `loading.tsx` where applicable).
3. Skeletons animate with a subtle pulse (CSS `@keyframes pulse` or `animate-pulse` from Tailwind).
4. Skeletons match the exact dimensions and layout of the final content (e.g., leaderboard rows maintain 48px height).
5. Switching between Thai and English UI does not affect skeleton appearance (no text dependency).
6. Edge cases handled: skeleton does not appear for cached/instant data; skeleton disappears smoothly on data arrival (no flicker if data arrives <200ms).

## Edge Cases
- **Fast data (<200ms)**: Optionally skip skeleton to avoid flash (use minimum display time or conditional rendering).
- **Error state**: Skeleton replaces with error message; skeleton should not remain indefinitely. Use timeout (e.g., 10s) to show fallback text.
- **Nested loading**: e.g., Dashboard loads header first then chart – skeletons for each sub-section independently.
- **Modal skip button**: "ข้าม" must always be clickable even when content skeleton is shown.
- **Responsive**: Skeletons collapse correctly on mobile (e.g., leaderboard rows stack vertically).
- **Accessibility**: Skeletons have `aria-hidden="true"` and `role="presentation"` to avoid confusing screen readers.

## Implementation Notes
- Use Tailwind `animate-pulse` and `bg-gray-200 dark:bg-gray-700` for light/dark mode.
- Create a reusable `<Skeleton width height rounded />` component under `components/ui/`.
- Thai translation for any skeleton-related labels (like "กำลังโหลด…") is unnecessary – skeletons are purely visual.

---

*Proposal for review. Not yet applied.*
