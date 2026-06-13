<!-- cc-team deliverable
 group: G1 (Fix patches from improve audit findings)
 member: FIX-002 role=fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2646,"completion_tokens":2935,"total_tokens":5581,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2381,"image_tokens":0},"cache_creation_input_tokens":0} | 32s
 generated: 2026-06-13T11:24:07.691Z -->
### ResolveEndpoint model trimming

The model string derived from environment variables (e.g. `LOCAL_OLLAMA_MODEL`, `REMOTE_OLLAMA_MODEL`) is not trimmed; leading/trailing whitespace will cause the lookup in `MODEL_TIMEOUT_MS` to fail and silently fall back to `DEFAULT_TIMEOUT_MS`.  
**Fix:** Trim the resolved model string in both the local and remote branches before using it for the timeout and the returned model field.

```typescript
function resolveEndpoint(kind: AgentEndpointKind, agentId: AgentId, runMode: AgentRunMode): AgentEndpoint {
  const timeoutFactor = runMode === "thinking" ? 2 : 1;
  if (kind === "local") {
    const model = (
      process.env.LOCAL_OLLAMA_MODEL ||
      process.env.OLLAMA_LOCAL_DEFAULT_MODEL ||
      process.env.OLLAMA_MODEL ||
      AGENT_MODEL_MDES[agentId] ||
      "qwen2.5:14b"
    ).trim();
    return {
      kind,
      url:
        process.env.LOCAL_OLLAMA_BASE_URL ||
        process.env.OLLAMA_LOCAL_BASE_URL ||
        process.env.OLLAMA_BASE_URL ||
        process.env.OLLAMA_HOST ||
        "http://localhost:11434",
      key: process.env.LOCAL_OLLAMA_TOKEN || process.env.OLLAMA_LOCAL_API_KEY || "",
      model,
      timeoutMs: (MODEL_TIMEOUT_MS[model] ?? DEFAULT_TIMEOUT_MS) * timeoutFactor,
    };
  }

  const model = (
    process.env.REMOTE_OLLAMA_MODEL ||
    process.env.OLLAMA_REMOTE_DEFAULT_MODEL ||
    process.env.MDES_PRIMARY_MODEL ||
    AGENT_MODEL_MDES[agentId] ||
    "qwen3.5:9b"
  ).trim();
  return {
    kind,
    url:
      process.env.REMOTE_OLLAMA_BASE_URL ||
      process.env.OLLAMA_REMOTE_BASE_URL ||
      process.env.OLLAMA_REMOTE_URL ||
      process.env.OLLAMA_URL ||
      "https://ollama.mdes-innova.online",
    key:
      process.env.REMOTE_OLLAMA_TOKEN ||
      process.env.OLLAMA_REMOTE_API_KEY ||
      process.env.OLLAMA_API_KEY ||
      "",
    model,
    timeoutMs: (MODEL_TIMEOUT_MS[model] ?? DEFAULT_TIMEOUT_MS) * timeoutFactor,
  };
}
```
