<!-- cc-team deliverable
 group: G1 (component division)
 member: COMP-020 role=frontend model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":375,"completion_tokens":1240,"total_tokens":1615,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 33s
 generated: 2026-06-13T12:10:17.972Z -->
# Component Audit: `innomcp-next/src/app/api/log/route.ts`

This is a Next.js API route handler, not a React component, so most React-specific concerns (memo, keys, re-renders, hydration, dangerouslySetInnerHTML, error boundaries, state-in-render) do not apply. The audit below is scoped to what's actually present in the code, plus general API-route concerns (input validation, error handling, information disclosure).

| Severity | Location | Issue | Fix |
|---|---|---|---|
| **High** | `const data = await req.json();` | **No input validation / size limits.** Arbitrary client-supplied JSON is accepted and logged. This enables log injection, payload bombs (no `Content-Length` cap, no body size guard), and potential DoS via huge nested objects exhausting memory/JSON parser. | Validate with a schema (e.g. `zod` / `valibot`) and whitelist expected fields. Cap body size (e.g. `req.headers.get('content-length')` check, or front the route with middleware/body size limits). Reject unknown fields. |
| **High** | `console.log("[api/log] Login params:", data);` | **Sensitive data logged in plaintext.** The name "Login params" strongly suggests credentials (username/password, tokens, OTPs) are being persisted to stdout/logs — likely a PII / secret-disclosure / compliance (GDPR, SOC2) violation. | Never log credentials. Redact known sensitive keys (`password`, `token`, `secret`, `otp`, `cookie`, `authorization`). Better: log only a request ID and minimal metadata (route, status, duration, user ID if authenticated). |
| **High** | `console.log("[api/log] Login params:", data);` | **Log injection / control-character injection.** If `data` contains `\n`, ANSI escapes, or newlines, an attacker can forge fake log entries (e.g. fake "Login successful" lines), corrupting log integrity. | Serialize with a safe encoder (e.g. `JSON.stringify` is used implicitly, but ensure it — and strip/normalize control characters in string fields, or log through a structured logger like `pino` which handles this). |
| **Medium** | `console.log` / `console.error` | **No rate limiting / no auth on the logging endpoint.** Anyone can POST arbitrary data and spam your logs, filling disk and enabling the above attacks. | Add rate limiting (e.g. `upstash/ratelimit`, middleware, or edge config). Optionally require an internal token / origin check if the log endpoint should only be hit by your own client code. |
| **Medium** | Entire route | **No CSRF / origin protection context.** Next.js API routes by default accept any same-origin request; if the client uses cookie-based auth and the logging happens pre-auth, this can be abused. The route is also publicly callable. | Restrict allowed `Origin` / `Referer` headers, or require a signed client token for the logger. |
| **Medium** | `try { ... }` | **No logging of the actual error type / message.** Swallowing `error` to a generic `"Invalid log data"` makes debugging hard and hides server-side issues. | Log `error` with its full message/stack server-side (not in the response), and return a generic message to the client. |
| **Low** | `NextResponse.json({ success: true })` | **Response reveals endpoint is alive and accepting data** — minor info disclosure; helps attackers confirm the logging pipeline. | Optional: return minimal body (`204 No Content`) or a non-descriptive `{ ok: true }`. |
| **Low** | `export async function POST` | **No explicit `runtime` / `dynamic` declaration.** Default Node runtime + dynamic rendering is fine here, but worth pinning for edge-runtime migration awareness. | Add `export const runtime = "nodejs";` (or `"edge"` if migrating) and `export const dynamic = "force-dynamic";` for clarity. |
| **N/A** | — | **React-specific checks not applicable** to an API route: no JSX, no hooks, no `useState`/`useEffect`, no memo, no `key` props, no `dangerouslySetInnerHTML`, no hydration boundary. | — |

## Recommended rewrite (illustrative)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LogSchema = z.object({
  event: z.string().max(100),
  level: z.enum(["info", "warn", "error"]).optional(),
  // explicit allowlist — never accept free-form "params" on a login event
}).strict();

const MAX_BYTES = 10_000;

export async function POST(req: NextRequest) {
  // 1. Size guard
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) {
    return NextResponse.json({ success: false }, { status: 413 });
  }

  // 2. Parse + validate
  let payload;
  try {
    payload = LogSchema.parse(await req.json());
  } catch (err) {
    console.error("[api/log] validation failed", err);
    return NextResponse.json({ success: false }, { status: 400 });
  }

  // 3. Structured, redacted logging
  console.log(JSON.stringify({ at: new Date().toISOString(), ...payload }));

  return NextResponse.json({ ok: true });
}
```

**Bottom line:** No React-component issues exist in this file (it's a server route), but the file has two **High**-severity problems — logging what looks like login credentials, and accepting unvalidated untrusted input — that should be fixed before this ships.
