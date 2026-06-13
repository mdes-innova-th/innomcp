<!-- cc-team deliverable
 group: G1 (component division)
 member: COMP-004 role=frontend model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":375,"completion_tokens":1414,"total_tokens":1789,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":654,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 12s
 generated: 2026-06-13T12:07:07.042Z -->
# API Route Audit: `route.ts`

> **Note:** This is a **Next.js API route** (server-side), not a React component. Most of the requested audit categories (re-renders, memo/keys, effect deps, state-in-render, prop drilling, dangerouslySetInnerHTML, hydration) are **inapplicable**. The audit below covers the relevant concerns for this module type.

| severity | location | issue | fix |
|----------|----------|-------|-----|
| 🟠 Medium | `fetch()` call (L20-23) | **Stale cached response** — Next.js App Router caches `fetch` by default; metrics will serve stale data on subsequent requests | Add `cache: 'no-store'` to fetch options, or `next: { revalidate: 0 }` |
| 🟠 Medium | `AbortSignal.timeout(5000)` (L22) | **Runtime compatibility risk** — `AbortSignal.timeout()` requires Node ≥ 17.3; will throw `TypeError` on older runtimes, crashing the handler | Use `AbortController` with `setTimeout` fallback, or validate Node version in CI |
| 🟡 Low | `decoded.userrole_id !== 0` (L9) | **Magic number / type-unsafe** — `0` is an undocumented admin role; if `decoded` is `null`, this line throws before the null guard on the same line | Guard null first: `if (!decoded \|\| decoded.userrole_id !== 0)` and extract `ADMIN_ROLE = 0` as a named constant |
| 🟡 Low | `jwtResult` type union (L7-9) | **Implicit type narrowing** — `jwtResult` is either `NextResponse` or an object with `decoded`; no TypeScript interface enforces this, making the `decoded` property access fragile | Define a discriminated union type for `jwtMiddleware` return and use type guards |
| 🟡 Low | `res.json()` (L27) | **No schema validation** — backend response is forwarded without validation; a malformed backend response propagates unchecked | Validate with Zod/schema before returning; strip unexpected fields |
| 🟢 Info | Entire route | **No rate limiting** — admin endpoint is protected by JWT only; no throttle against credential abuse | Add rate-limiting middleware (e.g., `next-rate-limit`, or handle at the edge/gateway) |
| 🟢 Info | `process.env.NODE_BACKEND_HOST` (L12) | **Silent fallback to localhost** — in production, a missing env var silently routes to `localhost:3011`, which will fail opaquely | Throw at startup if `NODE_BACKEND_HOST` is unset in production, or log a warning |

### Key Action Items

1. **Disable fetch cache** — this is the most likely production bug. Metrics must be fresh:
   ```ts
   const res = await fetch(`${backendHost}/api/metrics`, {
     headers: { "Content-Type": "application/json" },
     cache: "no-store", // ← critical for real-time metrics
     signal: AbortSignal.timeout(5000),
   });
   ```

2. **Harden the JWT guard** — the current null check is order-dependent and fragile:
   ```ts
   const ADMIN_ROLE = 0 as const;
   if (!decoded || decoded.userrole_id !== ADMIN_ROLE) {
     return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
   }
   ```

3. **Replace `AbortSignal.timeout`** for broader runtime support:
   ```ts
   const controller = new AbortController();
   const timeoutId = setTimeout(() => controller.abort(), 5000);
   try {
     const res = await fetch(url, { signal: controller.signal, ... });
     // ...
   } finally {
     clearTimeout(timeoutId);
   }
   ```
