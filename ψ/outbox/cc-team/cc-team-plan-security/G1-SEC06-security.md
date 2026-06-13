<!-- cc-team deliverable
 group: G1 (Security audit)
 member: SEC06 role=security model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2760,"completion_tokens":3284,"total_tokens":6044,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3019,"image_tokens":0},"cache_creation_input_tokens":0} | 44s
 generated: 2026-06-13T11:20:33.756Z -->
| Severity | Location | Vulnerability | Exploit Scenario | Fix |
|----------|----------|---------------|------------------|-----|
| HIGH | `loadCorpus` method — `corpusDir` parameter and `fs.readFileSync(file, "utf-8")` | **Path Traversal** via attacker-controlled directory + symlink following | 1. If `corpusDir` is supplied from user input (e.g., `../../etc`), the retriever can list and read files outside the intended corpus, leaking sensitive files. 2. An attacker who can create a symlink inside the corpus (e.g., via a file upload) pointing to `/etc/shadow` will cause the indexed content to include that file, leading to arbitrary file read. | Sanitize `corpusDir`: resolve to an absolute path and verify it stays within an allowed base directory. Use `fs.lstat`/`realpath` before reading to detect and skip symlinks. Do not use `fs.readFileSync` on untrusted paths without checks. |

**Verdict:** The `ColdRetriever` lacks any directory containment or symlink checks, allowing high-impact path traversal that can read arbitrary files if the corpus path or its contents can be influenced by an attacker.
