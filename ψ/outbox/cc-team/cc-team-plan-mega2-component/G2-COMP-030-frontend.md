<!-- cc-team deliverable
 group: G2 (component division)
 member: COMP-030 role=frontend model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":664,"completion_tokens":1522,"total_tokens":2186,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 30s
 generated: 2026-06-13T12:11:57.560Z -->
# Component Audit: `tmux/logs/route.ts`

**Note:** This is a Next.js API Route Handler, not a React component. The standard React/Next client-side concerns (memo/keys, hydration, error boundaries, `dangerouslySetInnerHTML`, effect deps, state-in-render, prop drilling) **do not apply**. The audit below covers the actual issues present in this server-side file, plus a note on adjacent client concerns to be aware of.

## Findings

| Severity | Location | Issue | Fix |
|---|---|---|---|
| 🔴 Critical | `resolveLogPath` (lines 7–11) | **Path traversal vulnerability** — `agentName` is taken directly from the query string and used to build file paths. `cleanName.toLowerCase().trim()` does not prevent `../../etc/passwd` style attacks. An attacker can read arbitrary `.log` files on the server. | Validate `agent` against a strict allowlist: `/^[a-z0-9_-]{1,32}$/`. Reject (400) anything else. Never concatenate untrusted input into filesystem paths. |
| 🔴 Critical | `GET` handler (line 22) | **Hardcoded Windows user path** leaks a real username (`USER-NT`) and couples the server to one developer's machine. Breaks on Linux/CI/macOS. | Remove the `C:\Users\USER-NT\...` candidate. Resolve the log directory from an env var (e.g. `process.env.AGENT_LOG_DIR`) with `os.tmpdir()` as fallback. |
| 🟠 High | `GET` handler (line 30) | **Synchronous filesystem read in request path** — `fs.readFileSync` blocks the event loop, scales poorly, and will hang the route on large/slow log files (no size cap, no streaming). | Use `fs.promises.readFile` inside a `try`, cap size with `fs.promises.stat` first and reject files > N MB, or stream via `fs.createReadStream(path, { encoding: 'utf8' })` piped and tailed. |
| 🟠 High | `resolveLogPath` (lines 7–18) | **`fs.existsSync` in a loop** — race-condition prone (file can appear/disappear between check and read) and blocks the event loop. Also enumerates candidate paths on every request. | Drop the probe loop; resolve once from a configured base directory. If multiple roots are needed, read from the configured dir directly and surface a `not found` JSON response on ENOENT. |
| 🟡 Medium | `GET` handler (lines 23–43) | **No authn/authz / rate limiting** — any caller can hit the endpoint and read log files. On a public deployment this leaks filesystem info via the `path` field. | Gate behind session/middleware auth, add rate limiting (e.g. per-IP token bucket), and strip `path` from the response body for non-existent files. |
| 🟡 Medium | `GET` handler (line 41) | **Information disclosure in error responses** — `error.message` is returned verbatim to the client. Can leak absolute paths, OS errors, or stack-internal text. | Log the full error server-side and return a generic `{ error: "Internal error" }` with a correlation ID. |
| 🟡 Medium | `GET` handler (line 28) | **`fs.existsSync` race** — classic TOCTOU; file may vanish before `readFileSync` runs and throw a confusing 500. | Wrap the read in the same `try/catch` and translate `ENOENT` to the structured `{ exists: false }` response instead of a 500. |
| 🟢 Low | `GET` handler (line 26) | **Unbounded memory on read** — `fs.readFileSync` loads the entire file into memory before slicing. A multi-GB log will OOM the route. | Stream the tail: read only the last ~64 KB, split on newlines, or use a `readline` interface over a stream. |
| 🟢 Low | Module scope | **No `runtime` / `dynamic` export** — route will be evaluated at build time on platforms that pre-bundle edge/Node routes, and may attempt to run in the Edge runtime where `fs` is unavailable. | Add `export const runtime = "nodejs";` and `export const dynamic = "force-dynamic";` to make intent explicit. |
| ℹ️ Info | Whole file | **No client-side concerns present** — no JSX, no hooks, no `useState`/`useEffect`, no `dangerouslySetInnerHTML`, no `key` props, no hydration boundary. Items from the requested checklist (memo, keys, effect deps, state-in-render, prop drilling, error boundaries, `dangerouslySetInnerHTML`, hydration) are **not applicable** to a Route Handler. | When you build the consumer component (e.g. `<LogViewer>` that polls `GET /api/tmux/logs`), apply the checklist there: wrap in an error boundary, `useMemo` parsed lines, stable `key` on each `<li>`, `useEffect` cleanup for the polling `setInterval`, and never render raw `path` via `dangerouslySetInnerHTML`. |

## Recommended Secure Skeleton

```ts
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAME_RE = /^[a-z0-9_-]{1,32}$/;
const LOG_DIR = process.env.AGENT_LOG_DIR ?? "/var/log/agents";
const MAX_TAIL_BYTES = 64 * 1024;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agent = (searchParams.get("agent") ?? "innova").toLowerCase();

  if (!NAME_RE.test(agent)) {
    return NextResponse.json({ error: "invalid agent" }, { status: 400 });
  }

  const logPath = path.join(LOG_DIR, `${agent}.log`);

  try {
    const handle = await fs.open(logPath, "r");
    try {
      const { size } = await handle.stat();
      const start = Math.max(0, size - MAX_TAIL_BYTES);
      const buf = Buffer.alloc(size - start);
      await handle.read(buf, 0, buf.length, start);
      const lines = buf.toString("utf8").split(/\r?\n/).filter(Boolean).slice(-100);
      return NextResponse.json({ agent, exists: true, lines });
    } finally {
      await handle.close();
    }
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return NextResponse.json({ agent, exists: false, lines: [] });
    }
    // log err server-side, return generic message
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```
