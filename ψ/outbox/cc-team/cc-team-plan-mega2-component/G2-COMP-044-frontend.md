<!-- cc-team deliverable
 group: G2 (component division)
 member: COMP-044 role=frontend model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":2147,"completion_tokens":3099,"total_tokens":5246,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2029,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 35s
 generated: 2026-06-13T12:14:59.669Z -->
# API Route Audit: `workspace/files/route.ts`

> **Note:** This is a server-side API route, not a React component, so categories like re-renders, memo/keys, state-in-render, prop drilling, and hydration are N/A. The audit focuses on security, correctness, and robustness issues in the same spirit.

| severity | location | issue | fix |
|----------|----------|-------|-----|
| 🔴 Critical | `getSafePath` | **Symlink path traversal** — `path.resolve`/`path.normalize` don't resolve symlinks. A symlink inside `workspace-storage` pointing outside (e.g. → `/etc/passwd`) passes the prefix check, then `fs.readFile` follows it and leaks/exposes external files. | Use `await fs.realpath(safePath)` after the prefix check and re-validate the real path starts with `BASE_PATH`. Alternatively, use `fs.open` + `fstat` + `O_NOFOLLOW`-style checks, or `fs.lstat` to reject symlinks. |
| 🔴 Critical | POST handler | **No authentication/authorization** — any unauthenticated caller can write arbitrary files (within extension whitelist) to the server filesystem. | Add auth middleware or session check before processing writes. |
| 🟠 High | GET handler (line ~30-35), DELETE handler (line ~155-160) | **TOCTOU race condition** — `fs.access()` is called first, then `fs.stat()` / `fs.unlink()` in separate steps. The file can be swapped/removed between calls. | Remove redundant `fs.access()`; call `fs.stat()` directly and catch `ENOENT` to handle "not found". |
| 🟠 High | DELETE handler (line ~148-155) | **Misleading error for directories** — extension check (`ALLOWED_EXTENSIONS.includes(ext)`) runs *before* the `isFile()` check. Deleting a directory named `myfolder` returns "file type not allowed" instead of "can only delete files". | Move `stat.isFile()` check before the extension check so directories get the correct error message. |
| 🟠 High | POST handler (line ~120) | **Unvalidated `encoding` from user input** — `encoding` is cast to `BufferEncoding` without validation. Unexpected encodings can cause `Buffer.byteLength` or `fs.writeFile` to throw or behave unpredictably. | Whitelist allowed encodings: `const ALLOWED_ENCODINGS = ["utf8", "ascii", "latin1"]; if (!ALLOWED_ENCODINGS.includes(encoding)) return 400;` |
| 🟡 Medium | GET handler (directory branch) | **No pagination / result cap** — `fs.readdir` on a directory with thousands of entries causes large payloads and potential timeout. | Add `limit`/`offset` query params or cap results (e.g. `entries.slice(0, 1000)`). |
| 🟡 Medium | All handlers | **No rate limiting** — endpoints are vulnerable to abuse / DoS (especially POST which writes to disk). | Add rate-limiting middleware (e.g. `next-rate-limit`, or a reverse-proxy rule). |
| 🟡 Medium | `getSafePath` | **Case-insensitive filesystem bypass** — on Windows/macOS (case-insensitive), `normalised.startsWith(BASE_PATH + path.sep)` can be bypassed with differently-cased paths. | Compare with case-insensitive fallback: `normalised.toLowerCase().startsWith(BASE_PATH.toLowerCase() + path.sep)`. |
| 🟡 Medium | POST handler | **No file content validation** — only the extension is checked. A `.pdf` or `.html` file with malicious content can be stored and later served to clients. | Validate MIME/content where feasible; serve downloads with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`. |
| 🔵 Low | GET handler (directory branch) | **Redundant `fs.stat`** — `fs.stat(fullEntryPath)` is called for every allowed file, but `withFileTypes` already did a stat internally. Minor perf hit on large directories. | Accept the trade-off (needed for `size`/`mtime`), or use `dirent.stat()` on Node ≥ 18. |
| 🔵 Low | DELETE handler (end of file) | **Truncated code** — handler ends with `} catc`, meaning the catch block and function close are missing. | Complete the `catch` block mirroring the pattern in GET/POST. |
| 🔵 Low | All handlers | **No CORS headers** — API is wide open or blocked depending on Next.js defaults. | Add explicit CORS policy via Next.js middleware or `headers()` in `next.config.js`. |

---

### Top Priority Fix — Symlink Traversal

```typescript
async function getSafeRealPath(relativePath: string): Promise<string | null> {
  if (relativePath.includes("\0")) return null;
  const resolved = path.resolve(BASE_PATH, relativePath);
  const normalised = path.normalize(resolved);

  // 1. Prefix check (before resolving symlinks)
  if (
    !(
      normalised.startsWith(BASE_PATH + path.sep) ||
      normalised === BASE_PATH
    )
  ) {
    return null;
  }

  // 2. Resolve symlinks and re-verify the real path
  let realPath: string;
  try {
    realPath = await fs.realpath(normalised);
  } catch {
    return null; // path doesn't exist yet (ok for POST/create)
  }

  if (
    !(
      realPath.startsWith(BASE_PATH + path.sep) ||
      realPath === BASE_PATH
    )
  ) {
    return null;
  }

  return realPath;
}
```

> For the POST case where the file doesn't exist yet, also verify `path.dirname(safePath)` with `realpath` to ensure the *parent* directory isn't a symlink escaping the sandbox.
