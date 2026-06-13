# UX Spec: Error Toast Taxonomy for innomcp

## Problem
Current error handling is inconsistent: 401 loops on expired tokens cause toast spam, 404s show raw React errors, and no retry or dismissal logic exists. Users (Thai/English) need clear, actionable feedback.

## Proposed Solution
Adopt a unified `ErrorToast` system with defined categories, severity, auto-dismiss, retry, and i18n.

### Categories & Mapping

| Category | HTTP Errors | Thai Message | English Message | Severity Color | Auto-dismiss | Retry? |
|----------|-------------|--------------|-----------------|----------------|--------------|--------|
| Network | 0, timeout | “การเชื่อมต่อขัดข้อง โปรดลองอีกครั้ง” | “Network error. Please try again.” | Red | 8s | Yes |
| Auth | 401, 403 | “เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่” | “Session expired. Please log in again.” | Orange | 10s | No (redirect) |
| Validation | 400, 422 | “ข้อมูลไม่ถูกต้อง: {msg}” | “Invalid input: {msg}” | Yellow | 6s | No |
| Server | 500, 502 | “ข้อผิดพลาดภายในเซิร์ฟเวอร์” | “Internal server error.” | Red | 12s | Yes |

### 401-loop Fix
- On 401, clear token, show auth toast once, `router.push('/login')`. Suppress subsequent toasts until navigation.
- Use a global Axios interceptor + toast deduplication (React ref).

### 404 Cases
- API 404: Server toast "ไม่พบข้อมูล" / "Resource not found" (yellow, 6s, no retry).
- Route 404: Handled by Next.js `not-found.js`, no toast needed.

### Component Changes
All under `innomcp-next/src/app/components/chat/`:

- **`ErrorToastProvider.tsx`**: Context provider with `showToast(error, options)`. Manages queue, dedup, auto-dismiss timers.
- **`ErrorToast.tsx`**: Presentational component with severity icon, message, retry button, close button.
- **`toastConfig.ts`**: Map of categories to defaults (color, timing, messages for `en`/`th`).
- **`hooks/useErrorHandler.ts`**: Hook to wrap API calls, intercept network/auth errors, and call `showToast`.

### i18n
- Use existing Next.js `next-intl` setup. Messages stored in `messages/{en,th}.json` under `toast.*` keys.
- `toastConfig.ts` references locale via `useTranslations`.

### Acceptance Criteria
1. All 4 error categories render correct Thai/English message.
2. 401 shows once, redirects, no infinite loop.
3. Dismiss times match spec; toast can be manually closed.
4. Retry button re-triggers the original API call.
5. Network errors show only after retry timeout (no spam on quick reconnects).
6. Component tests with Playwright: verify toast appearance, dismissal, retry.

### Edge Cases
- Multiple errors in < 1s: deduplicate by message + category; queue latest.
- Page unmount: clear all timers.
- Slow network: show loading state, not error toast, until timeout.
- User clicks retry while another retry in flight: disable button, show spinner.
- Locale switch during toast lifetime: update message live (not required initially, can rerender).
