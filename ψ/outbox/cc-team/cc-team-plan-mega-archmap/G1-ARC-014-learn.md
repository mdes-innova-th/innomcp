<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-014 role=learn model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":188,"completion_tokens":867,"total_tokens":1055,"prompt_tokens_details":{"cached_tokens":32,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":703,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 9s
 generated: 2026-06-13T11:59:24.733Z -->
**Responsibility:** Adapts raw artifact data from the utility layer into the specific DTO (`buffer`, `mimeType`, `name`) required by the HTTP router.

**Exported API:** `listArtifacts(taskId)`, `getArtifact(taskId, name)`

**Upstream Callers:** HTTP router/controllers requesting task outputs.

**Downstream Deps:** `../utils/artifacts` (storage/data-access layer).

**Pipeline Role:** Final retrieval step; fetches generated agent outputs (files, logs, data) for client delivery post-task execution.

**Surprising Coupling:** The hardcoded `Buffer.from(artifact.content, 'utf-8')` tightly couples the service to text-based artifact storage. This implies binary artifacts (images, PDFs) will corrupt unless pre-encoded as UTF-8 strings in the utility layer, leaking storage implementation details into the transport/DTO formatting layer.
