<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D048 role=doc model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":381,"completion_tokens":1438,"total_tokens":1819,"prompt_tokens_details":{"cached_tokens":81,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1409,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 30s
 generated: 2026-06-13T11:27:25.256Z -->
- **`default`** (`Router`): Express router exposing `POST /api/analyze`. Expects a JSON body with either `csv` (raw CSV string) or `filePath` (workspace-relative path), delegates to `analyzeData`, and returns an `AnalysisResult` JSON payload.  
  **Caveat:** Responds with 400 if both `csv` and `filePath` are omitted, or if analysis throws; `filePath` is resolved against `WORKSPACE_ROOT` (defaults to `../workspace` when the env variable is unset).
