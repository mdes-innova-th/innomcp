<!-- cc-team deliverable
 group: G1 (serverdeep division)
 member: SERV-012 role=audit model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1903,"completion_tokens":5497,"total_tokens":7400,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4516,"image_tokens":0},"cache_creation_input_tokens":0} | 102s
 generated: 2026-06-13T12:12:24.199Z -->
### Audit Summary

Since `tmdApiConfig.ts` is a purely synchronous configuration and utility module, it contains **no async operations, network calls, or open handles**. Therefore, categories like *unhandled rejections, missing timeouts, race conditions, and resource leaks* are not applicable here. 

The audit focuses heavily on **error envelope correctness** (how configuration errors are surfaced to the LLM via MCP) and **MCP protocol edge cases** (tool routing and JWT scope parsing).

### Bug Audit Table

| severity | location | issue | fix |
|---|---|---|---|
| **High** | `getTmdCredsForTier` | **Error Envelope Correctness**: Throws a generic `Error`. In MCP, unhandled exceptions in tool execution bubble up to the SDK as generic JSON-RPC `-32603` Internal Errors. The actionable configuration hint (e.g., "ตั้งค่า TMD_UID_API...") is lost and never reaches the LLM/user. | Define and throw a custom `TmdConfigError extends Error`. The MCP tool handler wrapper should catch this specific class and return it as a structured Tool Result (`isError: true`) with the hint in the `content` text so the LLM can inform the user. |
| **Medium** | `decodeNwpJwtScopes` | **Protocol Edge Case / Robustness**: 1) Manual Base64URL padding `(4 - raw.length % 4) % 4` is flawed (produces `===` for `len % 4 == 1`). 2) Only checks `payload.scopes` (array), ignoring standard OAuth2 `payload.scope` (space-separated string). 3) Doesn't filter non-string array elements. | 1) Use native `Buffer.from(parts[1], 'base64url')` (Node 16+) to eliminate manual padding. 2) Add fallback to parse `payload.scope.split(' ')`. 3) Filter results: `.filter(s => typeof s === 'string')`. |
| **Medium** | `getTmdTierForTool` | **MCP Protocol Edge Case**: Silently defaults to `"api"` for unknown tool names. If a developer adds a new demo tool but forgets to update `TMD_ENDPOINT_TIERS`, it will silently use API credentials, causing confusing 401/403 auth errors that mask the routing bug. | Throw an error for unmapped tool names to fail fast during development, or validate at server startup that all registered MCP tools exist in the `TMD_ENDPOINT_TIERS` map. |
| **Low** | `checkNwpScopes` & `getTmdCredsForTier` | **Performance / State Consistency**: Reads `process.env` and decodes the JWT on every invocation. If called per-request, this adds unnecessary CPU overhead and risks inconsistent state if env vars are mutated at runtime. | Parse, validate, and cache credentials and JWT scopes once at module initialization. Fail fast on startup if required config is missing, rather than deferring the crash to the first tool call. |

### Recommended Code Fixes

**1. Custom Error Class for MCP Envelope (High Severity)**
```typescript
export class TmdConfigError extends Error {
  constructor(message: string, public tier: TmdKeyTier) {
    super(message);
    this.name = "TmdConfigError";
  }
}

// Inside getTmdCredsForTier:
throw new TmdConfigError(`TMD_API_PARAMS_MISSING [tier=${tier}]: ${hint}`, tier);
```

**2. Modernized & Robust JWT Decoding (Medium Severity)**
```typescript
export function decodeNwpJwtScopes(jwt: string): string[] {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return [];
    
    // Native base64url decoding (Node 16+), no manual padding/replacement needed
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    
    // Support both array (custom) and space-separated string (OAuth2 standard)
    let scopes: unknown[] = [];
    if (Array.isArray(payload.scopes)) {
      scopes = payload.scopes;
    } else if (typeof payload.scope === "string") {
      scopes = payload.scope.split(" ");
    }
    
    return scopes.filter((s): s is string => typeof s === "string");
  } catch {
    return [];
  }
}
```
