<!-- cc-team deliverable
 group: G2 (component division)
 member: COMP-039 role=frontend model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":502,"completion_tokens":1784,"total_tokens":2286,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":896,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 18s
 generated: 2026-06-13T12:13:34.409Z -->
# API Route Audit: `logout/route.ts`

This is a **server-side API route**, not a React component, so classic React issues (re-renders, memo, keys, hydration) are N/A. However, there are significant **logic and security issues** that directly impact the user-facing behavior:

| severity | location | issue | fix |
|----------|----------|-------|-----|
| 🔴 High | `if (jwtResult instanceof NextResponse) { return jwtResult; }` | **Logout is blocked when JWT is invalid/expired.** Cookie is never cleared, so the user is stuck — they can't log out and can't stay logged in. | Always clear the cookie first, then check JWT only for logging. Move cookie clearing before the JWT early-return, or remove the early-return entirely. |
| 🔴 High | `await logUserActivity(...)` inside main try block | **If `logUserActivity` throws, logout returns 500 and cookie is never cleared.** A logging failure should not prevent logout. | Wrap `logUserActivity` in its own try-catch so logout succeeds even if logging fails. |
| 🟡 Medium | `userId = jwtResult.decoded.user_id \|\| 0` | **Falsy `user_id` (e.g., `0`) is overwritten to `0`** — impossible to distinguish "missing" from "legitimately 0". | Use nullish coalescing (`??`) or explicit undefined check instead of `\|\|`. |
| 🟡 Medium | `request instanceof NextRequest ? request : new NextRequest(request)` | **Unnecessary wrapping.** In App Router route handlers, `request` is already a `NextRequest`. Re-wrapping can drop headers/body metadata. | Change function signature to `POST(request: NextRequest)` and pass `request` directly to `jwtMiddleware`. |
| 🟡 Medium | No error boundary at the route level | **No `NEXT_ERROR` or structured error response** for unhandled edge cases (e.g., `jwtMiddleware` throwing instead of returning `NextResponse`). | Add a top-level catch that returns a consistent error response, or add an `error.ts` boundary in the route directory. |
| 🟢 Low | `typeof jwtResult.decoded === "object"` | **Loose type guard** — `null` also passes this check. | Add explicit null check: `jwtResult.decoded !== null && typeof ...` |
| 🟢 Low | `domain: process.env.COOKIE_DOMAIN \|\| ".dataxo.info"` | **Hardcoded fallback domain** — if env var is misconfigured, cookie silently scopes to `.dataxo.info` on all production deployments. | Remove hardcoded fallback or make it explicit/validated at startup. |

---

### Recommended Refactored Core Logic

```typescript
export async function POST(request: NextRequest) {
  // 1. ALWAYS clear cookie first — logout must never be blocked
  const response = NextResponse.json({ message: "Logged out successfully" });
  const tokenName = process.env.TOKEN_NAME || "token";
  response.cookies.set(tokenName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
    ...(process.env.NODE_ENV === "production" && {
      domain: process.env.COOKIE_DOMAIN || ".dataxo.info",
    }),
  });

  // 2. Best-effort logging — never block logout
  try {
    const jwtResult = jwtMiddleware(request);
    let userId: number | undefined;
    if (
      jwtResult &&
      !(jwtResult instanceof NextResponse) &&
      jwtResult.valid &&
      jwtResult.decoded &&
      jwtResult.decoded !== null
    ) {
      userId = jwtResult.decoded.user_id ?? undefined;
    }
    await logUserActivity({
      user_id: userId ?? 0,
      activity: "Logout/Cookie cleared",
      request,
    });
  } catch (logError) {
    // Logging failure must not prevent logout
    console.error("Logout logging failed:", logError);
  }

  return response;
}
```

**Key changes:**
1. Cookie is **always cleared** regardless of JWT state
2. Logging is **non-blocking** — wrapped in its own try-catch
3. Signature uses `NextRequest` directly — no redundant wrapping
4. Nullish coalescing (`??`) instead of `||` for user_id
