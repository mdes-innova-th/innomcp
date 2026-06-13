<!-- cc-team deliverable
 group: G4 (Doc generation)
 member: D081 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":562,"completion_tokens":753,"total_tokens":1315,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":502,"image_tokens":0},"cache_creation_input_tokens":0} | 11s
 generated: 2026-06-13T11:31:12.729Z -->
- **`router`** (default export)  
  Express Router that handles the `POST /api/fetch` endpoint for web fetching.  
  @param req.body.url – Required. The URL to fetch.  
  @param req.body.saveArtifact – Optional boolean (default `true`). If true, saves the fetched content as an artifact.  
  @param req.body.timeoutMs – Optional number. Overrides the default fetch timeout.  
  @returns On success: `FetchResult` object (`url`, `title`, `markdown`, `wordCount`, `fetchedAt`, `cached`, optional `artifactPath`). On failure: `{ error: string }` with status 400.  
  Non-obvious behavior / caveat:  
  - The workspace root is resolved from `WORKSPACE_ROOT` env var or falls back to `../workspace` relative to `process.cwd()`.  
  - URL validation is performed by `new URL(url)`; malformed or non‑HTTP URLs return a 400 error.  
  - All errors (network, SSRF, invalid input) are served as 400 – non‑retryable from the client side.
