# UX Spec: i18n (th/en) Coverage for innomcp

## Problem
Multiple screens contain hardcoded mixed Thai‑English strings, inconsistent naming, and missing translations. Currently:
- **Onboarding modal** has a “ข้าม” skip button but other buttons/labels are English-only.
- **Chat UI** (`/living-chat`) mixes “ส่งข้อความ” (Send) with “Type your message...” placeholder.
- **Login** (`/login`) uses “เข้าสู่ระบบ” but error messages are English.
- **Dashboard** (`/dashboard`) has English headers with Thai data labels.

This creates a poor UX for bilingual users and complicates future locale additions.

## Proposed Solution
Adopt a lightweight **strings constants file** (no i18n framework).  
- File: `innomcp-next/src/app/i18n/strings.ts`  
- Exports objects per screen, e.g. `login`, `chat`, `onboarding`, `dashboard`.  
- Use key names (PascalCase) with values as nested `{ th: string; en: string }`.  
- Provide a simple `getLocale()` helper (from cookie/localStorage).  
- Components import and call `t('screen.key')`.

## Screens with Mixed Languages
| Screen | Thai | English | Hardcoded in file |
|--------|------|---------|-------------------|
| `/living-chat` | “ส่งข้อความ”, “พิมพ์ข้อความ...” | “Send”, “Type your message...”, “Chat with us” | `chat/ChatInput.tsx`, `ChatMessage.tsx` |
| `/login` | “เข้าสู่ระบบ”, “ลืมรหัสผ่าน” | “Login”, “Forgot password?”, “Invalid credentials” | `auth/LoginForm.tsx` |
| `/dashboard` | “ยอดคงเหลือ”, “ธุรกรรมล่าสุด” | “Dashboard”, “Recent transactions” | `dashboard/DashboardWidget.tsx` |
| Onboarding modal | “ข้าม” | “Next”, “Get started”, “Step X of Y” | `onboarding/OnboardingModal.tsx` |
| General UI | “กำลังโหลด...” | “Loading...”, “Error”, “Retry” | (multiple components) |

## Component-Level Changes (under `innomcp-next/src/app/components/`)
| Component | Change |
|-----------|--------|
| `chat/ChatInput.tsx` | Replace hardcoded placeholder & button text with `strings.chat.inputPlaceholder` and `strings.chat.sendButton`. |
| `chat/ChatMessage.tsx` | Use `strings.chat.messageTimestamp` patterns. |
| `auth/LoginForm.tsx` | Translate labels, buttons, error messages. |
| `onboarding/OnboardingModal.tsx` | Add keys for step indicator, “ข้าม”/skip, next, get started. |
| `dashboard/DashboardWidget.tsx` | Separate header/label strings. |
| Root layout (wrapper) | Provide a `LocaleProvider` context that reads persisted locale and exposes `t()` function. |

## Acceptance Criteria
1. All user-facing strings are defined in `strings.ts` and no hardcoded Thai/English remain.
2. Locale can be toggled (e.g. via URL query `?lang=en` or cookie) without page reload.
3. New locale additions require only adding key/value pairs to `strings.ts`.
4. Placeholders, buttons, errors, and modals display correctly in both languages.
5. Existing functionality (skip button, form submission) unchanged.

## Edge Cases
- **Missing translation**: Fallback to English key or show key name in development.
- **RTL**: Not needed (Thai uses left-to-right).
- **Dynamic content** (e.g. user names, numbers): Use template literals in values, not inside components.
- **Backend error messages**: Map via constants file; backend still returns English for now.
