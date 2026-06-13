<!-- cc-team deliverable
 group: G1 (Server-node module audit)
 member: SV008 role=audit model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2260,"completion_tokens":2726,"total_tokens":4986,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2535,"image_tokens":0},"cache_creation_input_tokens":0} | 35s
 generated: 2026-06-13T11:21:04.419Z -->
| severity | location | issue | proposed fix |
|----------|----------|-------|---------------|
| MEDIUM | `getTmdCredsForTier` (line ~48) | Per-field fallback can mix tier-specific uid/ukey with deprecated shared credentials (e.g., `TMD_UID_API` set but `TMD_UKEY_API` missing ⇒ uid from API tier, ukey from `TMD_UKEY`). This silently assembles an inconsistent credential pair, leading to hard-to-diagnose auth failures. | Apply fallback as a whole pair: after reading tier-specific env, if *either* uid or ukey is still empty, overwrite **both** with the deprecated `TMD_UID`/`TMD_UKEY` pair (or throw an error that the pair is incomplete). |

**Risk verdict:** Credential mixing can cause silent auth failures; other logic is safe.
