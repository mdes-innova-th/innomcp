<!-- cc-team deliverable
 group: G1 (Server-node module audit)
 member: SV010 role=audit model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2690,"completion_tokens":4720,"total_tokens":7410,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4178,"image_tokens":0},"cache_creation_input_tokens":0} | 63s
 generated: 2026-06-13T11:21:50.167Z -->
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `loadAudioBytes`: `fs.readFile(input.audioPath)` — no size check before read | Entire file is read into memory before checking `MAX_BYTES`, enabling memory exhaustion / DoS with a large allowed-extension file. | Use `fs.stat` to check file size and reject immediately if > `MAX_BYTES` before calling `readFile`. |
| HIGH | `loadAudioBytes`: `Buffer.from(payload, "base64")` — no size estimate before decode | Decodes the whole base64 string into memory before checking decoded size, allowing memory exhaustion / DoS with a huge payload. | Estimate decoded length (e.g., `(payload.length * 3)/4 - padding`) and reject early if estimate exceeds `MAX_BYTES`. |
| HIGH | `transcribeViaOpenAI` / `transcribeViaGateway`: `fetch(...)` without timeout | Network requests can hang indefinitely on unresponsive backends, blocking the MCP server with no abort mechanism. | Create `AbortController` with a sensible timeout (e.g., 120s) and pass `signal` to `fetch`. |
| HIGH | `loadAudioBytes`: `fs.readFile(input.audioPath)` allows path traversal | Attacker‑controlled `audioPath` can read any file with an allowed extension (e.g., `../../secret.mp3`) — no workspace root confinement. | Resolve `audioPath` against a configurable `WORKSPACE_ROOT`, then verify the resolved path stays inside that root using `path.resolve` + `startsWith` or `fs.realpath`. |
| MEDIUM | `execute`: relative `audioPath` resolves against `process.cwd()` | The tool describes workspace‑relative paths, but no workspace root is provided; relative paths may fail or read wrong files if cwd differs from intended workspace. | Accept a workspace root from environment or config, resolve relative paths against it, and reject paths that escape. |
| LOW | `transcribeViaGateway`: fallback `data.text \|\| data.transcription \|\| ""` | If the gateway returns neither field, the tool silently returns an empty transcription, hiding a backend data contract violation and possibly misleading callers. | Validate that at least one field contains a non‑empty string; throw an error with details if both are missing. |

**Risk verdict:** Multiple critical defects — path traversal, unbounded memory DoS via file/b64, and fetch hang — create exploitable vulnerabilities in a production tool.
