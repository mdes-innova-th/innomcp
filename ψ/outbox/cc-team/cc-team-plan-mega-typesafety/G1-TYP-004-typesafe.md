<!-- cc-team deliverable
 group: G1 (typesafety division)
 member: TYP-004 role=typesafe model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":193,"completion_tokens":991,"total_tokens":1184,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":925,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 11s
 generated: 2026-06-13T11:58:24.164Z -->
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| High | `getArtifact` -> `artifact.name/mime/content` | Missing null/undefined guard | Check `if (!artifact) throw new Error("Artifact not found");` before accessing properties |
| Medium | `getArtifact` method signature | Implicit any / missing return type | Add explicit return type: `Promise<{ name: string; mimeType: string; buffer: Buffer }>` |
