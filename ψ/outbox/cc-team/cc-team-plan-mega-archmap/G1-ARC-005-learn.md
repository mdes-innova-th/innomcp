<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-005 role=learn model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2564,"completion_tokens":756,"total_tokens":3320,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":507,"image_tokens":0},"cache_creation_input_tokens":0} | 15s
 generated: 2026-06-13T11:58:42.402Z -->
**Single responsibility:** Orchestrates a 3-brain agent pipeline (Brain‑1 deep analysis → Brain‑2 fast summary → Coordinator action/memory) for a given task.  
**Key API:** `MultiAgentOrchestrator` class – `createTask()` and `executeCycle()`; types such as `OrchestratorConfig`, `AgentTask`, `TaskCycle`.  
**Upstream callers:** TUI or chat controller issuing multi‑agent reasoning tasks (likely a “learn” pass).  
**Downstream deps:** `../providers/router` (provider selection), `fetch` to local Ollama endpoints; memory persistence writes to the shared `sharedMemoryPath`.  
**Role in pipeline:** Phase C neural coordinator – takes a task, runs the full analysis→summary→commit/review cycle, and records the decision cycle to disk.  
**Surprising coupling:** Hard‑codes default models (Minimax, Gemma variants) and directly calls Ollama `api/generate` with raw `fetch`; coordinator parses a single‑word action from LLM output (COMMIT/REVIEW/PUSH/SKIP), which is brittle and tightly couples to text generation shape.
