<!-- cc-team deliverable
 group: G1 (Security audit)
 member: SEC03 role=security model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":253,"completion_tokens":2037,"total_tokens":2290,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1768,"image_tokens":0},"cache_creation_input_tokens":0} | 26s
 generated: 2026-06-13T11:19:37.333Z -->
| severity | location | vulnerability | exploit scenario | fix |
| :--- | :--- | :--- | :--- | :--- |
| HIGH | `artifactService.listArtifacts(taskId)` / `getArtifact(taskId, name)` | Missing Authorization (IDOR) | An unauthenticated or low-privileged caller can supply arbitrary `taskId` values to enumerate or retrieve artifacts belonging to other users/tasks, leaking sensitive data. | Implement an authorization check that verifies the requesting principal owns – or is explicitly granted access to – the given `taskId` before serving artifacts. |
| HIGH | `artifactService.getArtifact(taskId, name)` (and potentially `listArtifacts`) | Path Traversal via unsanitized input | If the underlying `artifacts` module uses `taskId` or `name` to construct file‑system paths, an attacker can inject sequences like `../../../etc/passwd` to read arbitrary server files. | Validate and sanitize both parameters – reject `..`, `/`, `\` – or constrain the resolved path to a dedicated artifact storage root using a safe basename. |

**Verdict:** The artifact service completely lacks authorization and input validation, opening immediate IDOR and path‑traversal risks for any caller.
