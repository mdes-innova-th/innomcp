_27 findings consolidated, 1 missing._

# TRIAGE — improve

> Wave 2 (provider=0): fix-proposals for 4 known gaps + bug-audit of critical chat-path modules. Deliverables = assistant material for the Sonnet-mother to review and apply.

> Generated for mother-Sonnet review. provider=0 deliverables.


---

## GAP-MCP — gap-fix [deepseek/deepseek-v4-pro]
## Root cause
The innova-bot MCP server is never **connected** via an MCP client transport in the agent’s session setup. The tool metadata (`mcp_innovabot_*`) exists in the codex registry, but no live transport sends tool calls to the server – the skeleton tool handler reads static `.planning/*.md` files instead of invoking the server.

## Files/functions to change (best-guess paths)

| File | Function/Block | Purpose |
|------|----------------|---------|
| `innomcp-node/src/mcp/connector.ts` | `connectServers()` or `buildToolMap()` | Where MCP clients are created and tools collected |
| `innomcp-node/src/config/mcp-servers.ts` | export `activeServers` array / `getServers()` | Configure which MCP servers to mount |
| `innomcp-node/src/claude/session.ts` | `createSession()` / tool registration | Bind live tools to the Claude tool-use loop |
| `innomcp-server-node/src/servers/innovabot/index.ts` | (exists; verify export) | MCP server transport config (port, mode) |

*If the server is in-process:*  
- `innomcp-node/src/mcp/in-process-innovabot.ts` – create and register in-process transport.

## Code snippets

### 1. Add innova-bot to the active MCP server list
```typescript
// innomcp-node/src/config/mcp-servers.ts
export const mcpServersConfig: McpServerEntry[] = [
  {
    id: 'innovabot',
    name: 'innovabot',
    transport: {
      type: 'stdio', // or 'sse' if server is already running
      command: 'node',
      args: ['./dist/servers/innovabot/run.js'], // path to server entrypoint
    },
    // Remove fallback flag if present
    fallbackPattern: false, // ensure no .planning fallback
  },
  // ... other servers
];
```

### 2. Connect innova-bot and bind tools in the session
```typescript
// innomcp-node/src/mcp/connector.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mcpServersConfig } from '../config/mcp-servers.js';

export async function connectAllMcpServers(): Promise<Map<string, ToolDescription[]>> {
  const toolMap = new Map<string, ToolDescription[]>();

  for (const entry of mcpServersConfig) {
    if (entry.fallbackPattern) continue; // skip dummy entries

    const transport = buildTransport(entry);
    const client = new Client(
      { name: 'innomcp-node', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);
    const { tools } = await client.listTools();

    // Prefix tool names with mcp_<serverId>_ to match registry
    const prefixedTools = tools.map(t => ({
      ...t,
      name: `mcp_${entry.id}_${t.name}`, // e.g., mcp_innovabot_generate
    }));

    toolMap.set(entry.id, prefixedTools);

    // Store client for later tool execution
    mcpClients.set(entry.id, client);
  }

  return toolMap;
}
```

### 3. Wire live tool execution into Claude's session
```typescript
// innomcp-node/src/claude/session.ts
import { mcpClients } from '../mcp/connector.js';

async function executeToolCall(toolName: string, args: any): Promise<any> {
  // Check if tool belongs to an MCP server
  const parsed = toolName.match(/^mcp_(\w+)_(.+)$/);
  if (!parsed) return fallbackFileReader(toolName, args); // old manual fallback

  const [, serverId, actualToolName] = parsed;
  const client = mcpClients.get(serverId);
  if (!client) throw new Error(`MCP client for ${serverId} not connected`);

  const result = await client.callTool({ name: actualToolName, arguments: args });
  // Return content as text (MCP content types)
  return result.content.map(c => (c.type === 'text' ? c.text : '')).join('\n');
}
```

### 4. Remove/disable the old manual fallback (optional but safe)
```typescript
// innomcp-node/src/claude/session.ts: fallbackFileReader()
// Either delete the fallback import for innova-bot tools, or gate it:
if (!mcpClients.has('innovabot')) {
  // fallback to .planning/loop-peek-*.md
} else {
  // never use fallback – this ensures live tools
}
```

## Verification

1

---

## GAP-TABLE — gap-fix [deepseek/deepseek-v4-pro]
## Root Cause
MDES models (used in remote/AI mode) favour narrative prose and ignore implicit Markdown‑table formatting, while the Playwright TABLE‑01 test expects a rendered `<table>`. The current system prompt does not explicitly force Markdown‑table output, so the remote model replies with plain text or bullet lists.

## Fix Proposal: Two‑layer defence
1. **Prompt‑engineering** – extend the default system prompt to demand Markdown tables for all tabular answers.
2. **Fallback post‑processor** – automatically convert JSON‑array responses into Markdown tables before they reach the frontend.

---

## Exact Files & Functions

### 1. System Prompt (primary fix)
**File:** `packages/innomcp-node/src/core/prompts/default.ts`  
**Function:** exported `DEFAULT_SYSTEM_PROMPT` constant

**Change:** append the instruction below to the existing prompt.

```typescript
// packages/innomcp-node/src/core/prompts/default.ts
export const DEFAULT_SYSTEM_PROMPT = `
... existing ...
### Table Formatting (mandatory)
Whenever you are asked to provide lists, comparisons, or tabular data, you MUST reply with a well‑formed Markdown table.  
Use the exact pattern:
| Header 1 | Header 2 |
|----------|----------|
| data 1   | data 2   |
...
Never use plain paragraphs, bullet lists, or code blocks for tabular content.
`;
```

---

### 2. Fallback Post‑processor (optional but recommended)
**File:** `packages/innomcp-node/src/utils/tableFormatter.ts` (new)  
**Function:** `ensureMarkdownTable(text: string): string`

```typescript
// packages/innomcp-node/src/utils/tableFormatter.ts

/**
 * If the text does not already contain a Markdown table,
 * attempts to parse it as a JSON array of objects and
 * transform it into a Markdown table.
 */
export function ensureMarkdownTable(text: string): string {
  // Already a Markdown table → keep as‑is
  if (/\|[-| ]+\|/.test(text)) return text;

  const trimmed = text.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return text;

  try {
    const data = JSON.parse(trimmed);
    if (Array.isArray(data) && data.length > 0) {
      const headers = Object.keys(data[0]);
      const headerLine = `| ${headers.join(' | ')} |`;
      const separatorLine = `| ${headers.map(() => '---').join(' | ')} |`;
      const rows = data.map(item =>
        `| ${headers.map(h => String(item[h] ?? '')).join(' | ')} |`
      );
      return [headerLine, separatorLine, ...rows].join('\n');
    }
  } catch {
    // Non‑JSON, leave untouched
  }
  return text;
}
```

### 3. Apply post‑processor in LLM response stream
**File:** `packages/innomcp-node/src/services/llmService.ts`  
**Function:** where the full assistant text is assembled before emitting to the frontend (e.g., inside `streamCompletion` or a `onFinal` callback).

**Change:** wrap the final text with `ensureMarkdownTable`.

```typescript
// packages/innomcp-node/src/services/llmService.ts
import { ensureMarkdownTable } from '../utils/tableFormatter';

// ... inside the streaming handler, after the full message is collected:
const finalText = ensureMarkdownTable(accumulatedContent);
emit('data', { type: 'final', content: finalText });
```

---

## Verification Steps

1. **Manual test:**  
   - Start the stack in remote AI mode (MDES model).  
   - Send a prompt that requests tabular data, e.g., “Compare price, RAM, and storage of the three latest iPhone models in a table.”  
   - Confirm the frontend renders a proper `<table>` element.

2. **Automated Playwright test TABLE‑01:**  
   - Run `npx playwright test tests/table-matrix.spec.ts` (or your existing TABLE‑01 test).  
   - It should pass with remote AI mode.  
   - (Optional) Add a small unit test for `ensureMarkdownTable` to verify JSON → table conversion.

```typescript
// packages/innomcp-node/src/utils/__tests__/tableFormatter.test.ts
import { ensureMarkdownTable } from '../tableFormatter';

test('converts JSON array to markdown table', () => {
  const input = '[{"name":"A","val":1},{"name":"B","val":2}]';


---

## GAP-TOKENS — gap-fix [deepseek/deepseek-v4-pro]
## 1. Root cause
The SSE message builder in the agent pipeline never computes or attaches a `tokenCount` field to emitted chat messages, so the frontend chip receives `undefined`.

## 2. Files & functions to change

| File (innomcp-node) | Function | Purpose |
|---------------------|----------|---------|
| `src/utils/tokenizer.ts` (new) | `countTokens(text, model?)` | Token-count helper using `tiktoken` |
| `src/agents/chat-agent.ts` or `src/streaming/sse-publisher.ts` | Where assistant message object is assembled before `sse.send()` | Attach `tokenCount` |

*Best-guess paths based on typical monorepo layout; adjust to actual codebase.*

## 3. Code snippets

### 3.1 Token-count utility (`src/utils/tokenizer.ts`)
```typescript
import { encoding_for_model } from '@dqbd/tiktoken';
import type { TiktokenModel } from '@dqbd/tiktoken';

/**
 * Counts tokens in a string for a given model using tiktoken.
 * Falls back to 'gpt-4' if model is omitted.
 */
export function countTokens(text: string, model: TiktokenModel = 'gpt-4'): number {
  const enc = encoding_for_model(model);
  try {
    return enc.encode(text).length;
  } finally {
    enc.free();
  }
}
```

### 3.2 Attach tokenCount before SSE emission
In the function that constructs the final message object (e.g., inside `processAssistantResponse` or a `sendMessage` helper), right after the content is resolved:

```typescript
import { countTokens } from '../utils/tokenizer';

// ... within the message assembly
const assistantMessage: ChatMessage = {
  id: messageId,
  role: 'assistant',
  content: finalContent,
  // ... other fields
};

// Attach token count
assistantMessage.tokenCount = countTokens(finalContent);

await sse.send({ event: 'message', data: assistantMessage });
```

If the pipeline streams tokens chunk-by-chunk, compute the total after the stream ends and emit an updated message or a separate `metadata` event. Example:

```typescript
// At stream end
const totalContent = streamedChunks.join('');
const tokenCount = countTokens(totalContent);
// Either patch the previously sent message or send a metadata patch
sse.send({
  event: 'metadata',
  data: { messageId, tokenCount },
});
```

*Frontend must then merge `metadata.tokenCount` into the displayed message.*

## 4. Verification steps

1. **Unit test** – `countTokens('Hello world')` returns integer > 0.
2. **Integration smoke** – Launch the full stack. Send a chat message via the UI. Wait for the assistant response.
3. Inspect SSE event stream (browser DevTools → Network → Eventsource/SSE tab). Confirm the final assistant message event contains `"tokenCount": <number>`.
4. In the UI, the metadata chip should now display the token count (e.g., “32 tokens”).
5. Repeat with a long prompt to verify counts scale proportionally.

*If no SSE metadata patching is used, the chip will update immediately after the message event.*

---

## GAP-TOOLS — gap-fix [deepseek/deepseek-v4-pro]
## Root Cause
The chat UI supports only plain text messages and lacks file‑upload/action‑button mechanisms. The agent backend receives only text and never sees user intent to invoke `storageTool` (file up/download), `docWriterTool` (document generation) or `audioTranscribeTool` (audio transcription). Consequently, these MCP tools are registered on the server but unreachable from the polished user flow.

## Proposed Minimal Wiring

### 1. Frontend (`innomcp-next`)
**File:** `innomcp-next/src/components/ChatInput.tsx`
- Add a file‑upload button for audio files and a “Write Document” action button.
- On upload, submit `FormData` with the audio file and `intent: "transcribe"`.
- On “Write Document” click, send a special message like `/write-doc` containing the last assistant response.

**Snippet:**
```tsx
import { useState, useRef } from 'react';
import { sendAudioForTranscription, sendWriteDocRequest } from '../lib/api';

export default function ChatInput() {
  const [input, setInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('intent', 'transcribe');
    await sendAudioForTranscription(formData);
  };

  const handleWriteDocument = async () => {
    const lastAssistantMsg = /* get last assistant message from chat state */;
    await sendWriteDocRequest({ content: lastAssistantMsg });
  };

  return (
    <div className="flex gap-2 p-2 border-t">
      {/* hidden file input */}
      <input type="file" accept="audio/*" ref={fileRef} onChange={handleUpload} className="hidden" />
      {/* action buttons */}
      <button onClick={() => fileRef.current?.click()} title="Transcribe Audio">
        🎤
      </button>
      <button onClick={handleWriteDocument} title="Generate Document">
        📄
      </button>
      {/* normal text input + send button */}
      ...
    </div>
  );
}
```

**File:** `innomcp-next/src/lib/api.ts` (new)
- Add API helpers to call the backend with file or write‑doc intent.

```ts
export async function sendAudioForTranscription(formData: FormData) {
  const res = await fetch('/api/chat', { method: 'POST', body: formData });
  return res.json();
}

export async function sendWriteDocRequest(payload: { content: string }) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '/write-doc', payload }),
  });
  return res.json();
}
```

### 2. Backend API Route (`innomcp-node`)
**File:** `innomcp-node/src/routes/chat.ts` (or the chat endpoint handler)
- Detect multipart requests: extract file and intent, save file temporarily, then call the relevant MCP tool.
- For JSON requests, handle `/write-doc` command by calling `docWriterTool` with the provided content.

**Snippet:**
```ts
import { storageTool, docWriterTool, audioTranscribeTool } from '../mcp/tools'; // assumed imports
import formidable from 'formidable';
import fs from 'fs/promises';

router.post('/chat', async (req, res) => {
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    const form = new formidable.IncomingForm();
    form.parse(req, async (err, fields, files) => {
      if (err) return res.status(500).json({ error: 'Upload failed' });
      const intent = fields.intent;
      if (intent === 'transcribe') {
        const audioFile = files.file;
        const tempPath = audioFile.filepath;
        const transcription = await audioTranscribeTool.invoke({ audioPath: tempPath });
        await fs.unlink(tempPath); // cleanup
        return res.json({ type: 'transcription', text: transcription });
      }
    });
  }

  // plain JSON handling
  const { message } = req.body;
  if (message.startsWith('/write-doc')) {
    const content = req.body.payload?.content || message.slice('/write-d

---

## AUD-01 — audit — `innomcp-node/src/agents/conductor.ts` [deepseek/deepseek-v4-pro]
| severity | location (function or approx line) | issue | proposed fix |
|----------|-----------------------------------|-------|--------------|
| MEDIUM   | `safeEmit` (near the middle of the snippet) | `safeEmit` does not wrap calls to `checkAgentEventSafe` or `newEnvelope` in a try/catch. If either throws (e.g. due to a malformed event, a type mismatch, or a runtime error in the guard), the exception will propagate unhandled, potentially crashing the conductor loop without emitting any fallback event. | Wrap the body in a try/catch; on failure, emit a minimal generic fallback event instead of allowing the exception to escape. |

**Overall risk verdict:** Low – the visible helper functions are straightforward; the only concrete risk is the missing error handler in `safeEmit` that could cause silent crashes under unexpected input. Full audit requires the (truncated) main conductor logic.

---

## AUD-02 — audit — `innomcp-node/src/agents/parallelDispatch.ts` [deepseek/deepseek-v4-pro]
| severity | location | issue | proposed fix |
|----------|----------|-------|---------------|
| LOW | `resolveEndpoint` (model timeout lookup) | Model string derived from environment variables (e.g. `LOCAL_OLLAMA_MODEL`, `REMOTE_OLLAMA_MODEL`) is not trimmed; leading/trailing whitespace will cause the lookup in `MODEL_TIMEOUT_MS` to miss and silently fall back to `DEFAULT_TIMEOUT_MS`, potentially surprising operators. | Trim the model string before using it: `const model = (envValue || …).trim()` and then look up timeout. |

**Overall risk verdict:** Low — one benign configuration edge case; otherwise no runtime defects in the visible code.

---

## AUD-03 — audit — `innomcp-node/src/agents/orchestrator.ts` [deepseek/deepseek-v4-pro]
| severity | location | issue | proposed fix |
|----------|----------|-------|---------------|
| HIGH | `executeCycle` | Race condition — two concurrent calls for the same `taskId` can mutate the task object in interleaved order, corrupting status, results, and cycle entries. | Before execution, atomically check/set a lock per task, or reject if status is not "pending" (or "failed"). Use a mutex or sequential promise chain keyed by taskId. |
| HIGH | `callBrain` (and indirectly `executeCycle`) | Config fields `brain1Model` / `brain2Model` are defined but never passed to `selectProvider`. The orchestrator ignores the user’s model choices and may select a different model, breaking configuration intent. | Pass the configured model names to `selectProvider` (or override the `provider.model` after selection). For example: `selectProvider({ ..., preferredModel: this.config.brain1Model })`. |
| MEDIUM | `executeCycle` catch block | When an error occurs in any phase, the error entry is always written with `phase: "coordinate"` and `actor: "coordinator"`, misleadingly hiding where the failure really happened (e.g., during analysis). | Capture the current phase name in the catch scope, e.g., `let currentPhase = "analyze";` before each step, and use that in the error cycle entry. |
| MEDIUM | `createTask` | No validation of `description` — an empty string or whitespace-only description is accepted, leading to pointless LLM calls, failure, or garbled output downstream. | Validate that `description.trim().length > 0`; throw or return a rejected promise with a meaningful error. |
| LOW | `createTask` | ID generation `Math.random().toString(36).slice(2, 8)` can produce an empty string or very short ID (e.g., if `Math.random()` ≈ 0). | Use a robust ID generator (e.g., `crypto.randomUUID()` or ensure minimum length via padding/retry). |
| LOW | `callBrain` | If the Ollama API returns a 200 but the JSON body lacks a `response` field (e.g., `{}`), the method silently returns an empty string, which is then fed to the next phase without any warning or error. | After parsing, explicitly check that `result.response` is a non‑empty string; throw an error if missing to avoid silent propagation of empty results. |

**Overall risk verdict:** Multiple high-severity defects (ignored config models, race-condition corruption) make the orchestrator unreliable in production without fixes.

---

## AUD-04 — audit — `innomcp-node/src/agents/motherDispatch.ts` [deepseek/deepseek-v4-pro]
| severity | location | issue | proposed fix |
|----------|----------|-------|---------------|
| MEDIUM   | `getOracleToken` (approx. line after `_oracleToken` variable) | Race condition: concurrent calls may see `_oracleToken` as null/expired and both fetch a new token, causing duplicate auth requests and potential throttling. No synchronisation guard. | Introduce a promise-based deduplication lock (e.g., store a pending promise, reuse it for concurrent callers, reset on resolution/rejection). |
| MEDIUM   | `getOracleToken` + `callInnovaOracle` | Token cached globally with no invalidation on authentication failures (e.g., 401/403). A stale or revoked token will be reused for up to 23 hours, causing repeated call failures. | Clear `_oracleToken` (set to null) inside `callInnovaOracle` when fetch returns 401/403, or check token validity before use. |
| LOW      | `callInnovaOracle` (fetch + .json()) | `.json()` has no guard against non-JSON responses; a malformed body throws a raw SyntaxError, which the caller must handle. If caller does not have a catch for that specific error, it could become an unhandled rejection later. | Wrap `res.json()` in a try/catch that returns a placeholder string and does not break the orchestration. |
| LOW      | `buildProviderConfigs` (kind determination) | Provider `type` fallback sets kind to `"openai"` for any unknown type. If a new provider type is added without updating the mapping, it will be incorrectly classified as OpenAI, potentially leading to wrong API semantics or cost estimates. | Use an exhaustive switch/default with a safe fallback (e.g., `"unknown"`) and log a warning, or explicitly map all known types. |

**Overall risk verdict:** Low risk overall, but token caching has robustness gaps that could temporarily degrade the Oracle provider under concurrency or auth rotation.

---

## AUD-05 — audit — `innomcp-node/src/agents/toolDispatch.ts` [deepseek/deepseek-v4-pro]
| severity | location                           | issue                                                                                                                            | proposed fix                                                                                                   |
|----------|------------------------------------|----------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| HIGH     | `planToolCall`, lines ~146, ~164   | `extractThaiProvince` is invoked but neither imported nor defined in the module, causing a `ReferenceError` at runtime.          | Import or declare `extractThaiProvince` (e.g., from a geo utility) before it is used.                           |
| MEDIUM   | `extractMathExpression` / line ~56 | When the query contains no recognisable math (e.g., “calculate” alone), the function returns the original query string (“calculate”) as the tool argument, which will be silently rejected by the calculator tool. | Guard with a check – if safe expression is empty or has no digit, return a clear error plan or fallback sentinel. |

**Risk verdict:** HIGH – missing `extractThaiProvince` causes a definite runtime crash; MEDIUM – calculator tool may receive non‑evaluable expressions resulting in silent tool failures.

---

## AUD-06 — audit — `innomcp-node/src/agents/eventGuard.ts` [deepseek/deepseek-v4-pro]
| severity | location                 | issue                                                                                                                                                                                                                          | proposed fix |
|----------|--------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------|
| HIGH     | `checkAgentEventSafe` ~L74 (`JSON.stringify(ev)`) | `JSON.stringify` can throw a synchronous exception if `ev` contains circular references, BigInts, or other non-serializable values – the error is unhandled and will crash the node process. | Wrap `JSON.stringify(ev)` in a try‑catch; return `{ ok: false, reason: "serialization failure" }` on error. |
| MED      | `checkAgentEventSafe` ~L78–84 (key scanning) | The scan for forbidden keys lowercases the entire serialized JSON and matches the pattern `"<lowerkey>":` anywhere in the string, including inside JSON string values. This is stricter than the documented intent (“as a quoted key”) and can block events that merely mention the forbidden word in a user‑visible text field. | If the intent is truly to block only property names, parse the JSON and recursively scan keys (or use a JSON‑aware scanner). If the over‑eager scan is acceptable, update the comment to reflect the reality. |
| LOW      | `checkAgentEventSafe` ~L88–100 (visible literal scan) | The forbidden visible literals are matched with exact case using `includes`. If a placeholder string appears in a different case (e.g., `"weather map placeholder"`), it will pass through undetected, potentially leaking placeholder text. | Add an optional case‑insensitive flag to the literal list (or use a regex with `i`) for strings that are expected to appear regardless of casing. Alternatively, lower‑case both the literal and the visible string before comparison. |

**Overall risk verdict:** High risk of crash from unhandled serialization exceptions; the guard otherwise functions but may be over‑blocking or under‑blocking depending on exact content.

---

## AUD-07 — audit — `innomcp-node/src/services/intentClassifier.ts` [Qwen/Qwen3.7-Max]
| severity (HIGH/MED/LOW) | location (function or approx line) | issue | proposed fix |
|---|---|---|---|
| MED | `evidenceMatch` | The exclusion regex `/machine learning\|url encoding\|url คืออะไร/` applies unconditionally to ALL evidence hits. If a message contains strong evidence keywords (e.g., "forensic", "evidence") but also mentions "url encoding", it incorrectly returns `null`. | Move the exclusion regex inside the `if (["machine", "url", "traffic"]...)` block, or restrict it to only apply when `hit` is one of those ambiguous keywords. |
| LOW | `containsAny` | `k.toLowerCase()` is called inside the loop on every iteration. Since the keyword lists are static constants, this causes redundant string allocations and CPU work on every classification. | Pre-compute lowercase keywords when defining the constant arrays, or map them to lowercase once at module load. |
| LOW | `evidenceMatch` | The `hasOfficerSignal` regex is recompiled on every function invocation. | Extract the regex to a module-level `const` to avoid repeated compilation overhead. |
| LOW | Module scope / `classifyIntent` | `looksLikeSystemInventoryQuestion` is imported and `toolHint` parameter is declared, but neither is used in the visible logic (dead code/unused bindings). | Remove the unused import and parameter if they are truly unused in the truncated portion, or implement the intended logic. |

Overall risk: LOW — The module is a straightforward keyword matcher, but the overly broad regex exclusion in `evidenceMatch` can cause silent intent misclassification for valid forensic/evidence queries.

---

## AUD-08 — audit — `innomcp-node/src/services/responseComposer.ts` [moonshotai/Kimi-K2.6]
The user wants me to audit a TypeScript module `responseComposer.ts` for real defects. I need to look for concrete issues like bugs, race conditions, unhandled rejections, missing error handling, resource leaks, incorrect async/await, edge cases, and silent failures.

Let me analyze the code carefully:

1. **trimFact function**: `String(s || "")` - if `s` is passed but is not a string, this handles it. But wait, `trimFact` is called with `f.summary` which is typed as `string`. However, at runtime it could be null/undefined despite the type. The `String(s || "")` handles null/undefined. But what if `s` is already a string? It works fine.

2. **composeThaiAnswer**:
   - `const facts = Array.isArray(input.facts) ? input.facts : [];` - handles non-array facts
   - `const usable = facts.map(...).filter(...)` - looks okay
   - `if (usable.length === 0)` - returns no data message
   - Confidence filter: `const highConf = usable.filter((f) => (f.confidence ?? 1) >= 0.3);` - if confidence is undefined, defaults to 1. Good.
   - `const rendered = highConf.length > 0 ? highConf : usable;` - if all facts are low confidence, keeps all. Good.
   - Header handling: `if (input.header && input.header.trim())` - safe
   - Footer handling: `if (input.footer && input.footer.trim())` - safe
   - `lines.join("\n").trim()` - good

3. **Potential issues**:
   - **input.route**: `reasons.push(`route:${input.route || "unknown"}`);` - if `input.route` is undefined or null, it falls back to "unknown". But what if `input` itself is null or undefined? The function doesn't validate `input` existence. If `input` is null/undefined, `input.facts` will throw. However, TypeScript typing says it's `ResponseComposerInput`, but at runtime it could be null.
   - **input.userQuery**: It's in the interface but never used in the function. Not a defect, just unused.
   - **Date.now() - t0**: Could theoretically be negative if system clock changes, but extremely unlikely and not a real concern.
   - **composeThaiAnswerWithLLM**: It's async but calls a sync function. That's fine, it returns a Promise. No unhandled rejections since composeThaiAnswer doesn't throw (or does it?).
   - **Does composeThaiAnswer throw?** Let's check:
     - `Array.isArray(input.facts)` - if input is null, throws TypeError before this.
     - `facts.map` - safe because facts is guaranteed array.
     - `f.summary` - if f is null/undefined inside the array, `f.summary` will throw TypeError. The code does `facts.map((f) => ({ ...f, summary: trimFact(f.summary) }))`. If `f` is null or undefined, spreading `...f` works (null/undefined spread in objects throws in TS/JS? Actually, `{ ...null }` evaluates to `{}` in JS. Wait: `{ ...undefined }` throws TypeError in strict mode? Let me think. In JS, `{ ...null }` actually results in `{}` and doesn't throw. But `f.summary` would throw if f is null because null.summary throws. So if `input.facts` contains `null` elements, `f.summary` throws.
     - `trimFact(f.summary)` - if f.summary is missing, undefined is passed, handled by `String(s || "")`.
     - `f.source` in the loop - if f is null, this would have already failed at map time. But what if f is not null but f.source is undefined? `f.source ? ... : ""` handles it.
     - `f.confidence` - handled with `typeof` check.

4. **Real defects found**:
   - **Runtime null input**: If `input` is null or undefined, `input.facts` throws. Severity: MED or HIGH? Since this is a backend service, inputs could come from untrusted sources (HTTP handlers, etc.). Missing input validation is a real defect.
   - **Null elements in facts array**: If `input.facts` contains `null` or `undefined` elements, `f.summary` will throw TypeError at runtime despite TypeScript types. This is a concrete bug.
   - **NaN confidence**: `typeof f.confidence === "number" && f.confidence < 0.6` - if confidence is `NaN`, `typeof` is "number" and `NaN < 0.6` is false. But `(NaN * 100).toFixed(0)` would return "NaN%". Wait, the condition is `f.

---

## AUD-09 — audit — `innomcp-node/src/services/responseFormatter.ts` [zai-org/GLM-5.1]
| severity | location | issue | proposed fix |
|---|---|---|---|
| HIGH | `sanitize` | XSS bypass: regex `\son\w+="[^"]*"` misses unquoted event handlers (e.g., `onerror=alert(1)`); `\sjavascript:` misses `href="javascript:..."`; `<\/script>` misses `<\/script >` (space before `>`). | Replace regex-based sanitization with a battle-tested library like DOMPurify. |
| HIGH | `formatStream` / `streamBuffer` | Race condition/state corruption: `streamBuffer` is instance state on a Singleton. Concurrent requests will interleave chunks in the same buffer, corrupting streams. | Remove `streamBuffer` from the Singleton; pass a dedicated state object per stream, or instantiate `ResponseFormatter` per request. |
| MED | `formatStream` | Resource leak: If a stream ends with an unclosed code block (odd number of fences), `streamBuffer` retains the data indefinitely, leaking memory across the Singleton's lifetime. | Add a `flush()` or `endStream()` method to force-clear the buffer and return remaining data, resetting state. |
| MED | `renderMarkdown` | Incorrect formatting: Inline replacements (e.g., `**...**` to `<strong>`) are applied globally after code block extraction, corrupting content inside `<pre><code>` tags. | Extract code blocks into temporary placeholders, apply inline formatting to the remaining text, then restore the code blocks. |
| LOW | `truncate` | Contract violation: If `maxLength < ellipsis.length` (e.g., `maxLength=1`, `ellipsis='...'`), the returned string length exceeds `maxLength`. | Add an early return: `if (maxLength <= ellipsis.length) return text.slice(0, maxLength);` |
| LOW | `estimateReadingTime` | Silent logic error: `Math.max(1, ...)` forces a minimum of 1 word, causing empty strings to return a reading time of 1 second instead of 0. | Change to `Math.max(0, ...)` and return `0` if word count is `0`. |

Overall risk verdict: High risk due to critical XSS bypasses and concurrent state corruption in the singleton stream buffer.

---

## AUD-10 — audit — `innomcp-node/src/services/retrievalOrchestrator.ts` [MiniMaxAI/MiniMax-M3]
```markdown
| severity | location | issue | proposed fix |
|---|---|---|---|
| HIGH | `planRetrieval` (lines ~62-75, MIXED_PATTERNS loop) | `MIXED_PATTERNS` matches only if the *entire* query contains the connector (`.*และ.*อธิบาย` etc.), but `.*` in JavaScript regex without `s` flag does not match `\n` and is also excessively broad. A query like "อธิบาย X และ Y" matches, but a query like "อธิบาย X และ\nY" or "อธิบาย X และ y" partially may not. More importantly, the first matching pattern returns immediately, but the regex `เป็นอย่างไร.*คืออะไร` requires the *exact* order — natural Thai often reverses it ("คืออะไร และเป็นอย่างไร"), causing misclassification. | Add `s` flag where multi-line, and accept both word orders. Better: decompose into a small token-based classifier rather than fragile regex. |
| HIGH | `planRetrieval` (step 3, line ~83) | `hasColdPattern && hasHotPattern` returns `"hot+cold"` even when one of the patterns is a false positive (e.g., a query containing the word "อธิบาย" inside a filename or a quote). No signal weighting exists, so noise easily escalates to dual retrieval, increasing latency and cost on every call. | Score/rank patterns (e.g., count of hot vs cold tokens, or require pattern to match a noun phrase, not arbitrary substrings), and only escalate to `hot+cold` when intent is clearly mixed. |
| MED | `planRetrieval` (step 3, line ~94) | When `hasColdPattern && !hasHotPattern` but `coldRetriever.isReady()` is false, the function **falls through silently** — no return statement. It then re-evaluates step 4 (hot pattern), and if neither matches, step 5 (memory), and finally returns `"none"`. This is correct *only by accident*; the implicit fall-through is fragile to future refactors (adding a step between 3 and 4 would silently change behavior). | Add explicit `return { decision: "none", ..., reason: "cold_not_ready" };` after the `isReady()` check. |
| MED | `executeColdRetrieval` (line ~122) | Swallows the "not ready" case by returning `[]`, but the caller (`buildRetrievalResult`) cannot distinguish "retriever ran and found nothing" from "retriever unavailable" — both yield empty `coldResults` and the contract will report `retrievalUsed: "hot"` (or `"none"`) with no `degradedReason`. Silent degradation. | Either return a result wrapper `{ results, degraded, reason }` or surface a flag on the plan (`plan.coldDegraded = true`) and propagate via `meta.degradedReasons`. |
| MED | `extractColdQuery` (line ~178) | The two `.replace().trim()` calls operate on the result of the first `trim()` but the first replace strips to `""` for inputs like "วันนี้อากาศ" → `cold = ""` → falls back to original `query`. However, for a query like "วันนี้ สถานการณ์ระบาด คืออะไร" the regex `วันนี้\s*(อากาศ|evidence|สถานการณ์)[^\s]*\s*` only strips "วันนี้ สถานการณ์" leaving "ระบาด คืออะไร" — reasonable, but `[^\s]*` means it stops at the first whitespace so multi-word entities like "สถานการณ์น้ำท่วม" are only partially stripped, leaving "น้ำท่วม คืออะไร" which may still anchor cold search incorrectly. | Use a known operational-phrase allowlist and remove whole noun phrases, or pass the original query and let the retriever handle it. |
| MED | `buildRetrievalResult` (line ~141, `retrievalUsed`) | `retrievalUsed` is derived from `hotFacts.length` / `coldResults.length` *regardless of the plan's decision*. If a plan says `"hot"` but `coldResults` is non-empty (e.g., injected upstream), the contract will report `"both"` — contradicting the plan and possibly affecting downstream rendering/grounding logic. | Compute `retrievalUsed` from the plan, not from result sizes; or assert plan consistency. |
| MED | `planRetrieval` step 1 (line ~57) | `route && ["calculator", "datetime"].includes(route)` is correct, but there's no handling for `route === "general"` or unknown routes. A misrouted `route` value (typo, new route not yet handled) will skip the early-return and fall into regex matching, which may then return a meaningless pla

---

## AUD-11 — audit — `innomcp-node/src/services/toolExecutor.ts` [deepseek/deepseek-v4-flash]
| severity | location | issue | proposed fix |
|---|---|---|---|---|
| HIGH | `execute` (line ~84, before `try`) | `this.emit('tool:start', ...)` is outside `try` block; if a listener throws, the error propagates as an unhandled rejection, bypassing the catch and retry logic. | Move the emit inside the `try` block or wrap it in a separate `try/catch`. |
| MED | `execute` (line ~92, inside `try`) | `this.emit('tool:end', ...)` inside `try`; if a listener throws, it is caught by the outer `catch` and treated as a handler error, incorrectly reporting a tool failure. | Wrap the emit in its own `try/catch` to isolate listener errors from tool execution errors. |
| MED | `execute` (line ~104, inside `catch`) | `this.emit('tool:error', ...)` inside `catch`; if a listener throws, it propagates out of the catch, causing an unhandled promise rejection. | Wrap the emit in a `try/catch` to prevent listener errors from escaping. |
| LOW | `toErrorMessage` | `ToolParamError` is defined but never instantiated anywhere; potentially missing validation logic that should throw this error. | Either add parameter validation in `register`/`execute` using `ToolParamError`, or remove the unused class. |

**Overall risk

---

## AUD-12 — audit — `innomcp-node/src/services/providerFailover.ts` [Qwen/Qwen3.7-Max]
| severity | location | issue | proposed fix |
| :--- | :--- | :--- | :--- |
| HIGH | `selectProvider`, `getStats`, `resetAll` | Constructor accepts custom `primaryId`/`backupIds`, but these methods hardcode `DEFAULT_PRIMARY_ID`/`DEFAULT_BACKUP_IDS`. Passing custom IDs causes `this.statuses.get(...)` to return `undefined`, triggering a `TypeError` on property access due to the `!` non-null assertion. | Store `primaryId` and `backupIds` as private instance properties in the constructor and reference them instead of the global constants. |
| HIGH | `checkProvider` | Cooldown bypass: `if (!shouldAttemptCheck && status.healthy)` only skips the check if the provider is healthy. If unhealthy but the cooldown hasn't elapsed, it falls through and executes the health check anyway, completely defeating the circuit breaker cooldown. | Change the condition to `if (!shouldAttemptCheck) { return status.healthy; }`. |
| MED | `checkProvider` | Thundering herd: `status.lastCheck` is only updated *after* the async `healthChecker` resolves (inside `markFailed`/`markHealthy`). Concurrent calls right after cooldown expiry will all pass the `shouldAttemptCheck` gate and fire duplicate network checks. | Update `status.lastCheck = Date.now()` synchronously *before* `await this.healthChecker(...)`, or implement a per-provider in-flight promise lock. |
| LOW | `markFailed`, `markHealthy` | Unnecessary `async`: Methods are marked `async` but contain no `await` operations, adding unwarranted microtask queue overhead for simple synchronous state mutations. | Remove the `async` keyword and change the return type to `void`. |

HIGH RISK: Guaranteed runtime crashes when using custom provider configurations and a fundamentally broken circuit breaker cooldown mechanism.

---

## AUD-13 — audit — `innomcp-node/src/services/providerManager.ts` [moonshotai/Kimi-K2.6]
The user wants me to audit a TypeScript module for real defects. I need to be meticulous and report only concrete issues. The output format should be a markdown table with columns: severity, location, issue, proposed fix. Then a 1-line overall risk verdict. No praise, no restating what the code does, no filler.

Let me analyze the code carefully.

1. **Race condition in `register`**: The `register` method is async but doesn't do any async work. However, more importantly, it reads and writes to `this.providers` without any locking. If multiple concurrent registrations happen, or if `checkHealth` is running concurrently with `register`, there could be race conditions. But since it's single-threaded JavaScript, the actual Map operations are atomic. However, the `checkHealth` method mutates the provider object directly (`provider.healthStatus = ...`), and if `register` is called concurrently (or rather, interleaved due to async), it could replace the provider object in the map while `checkHealth` is mutating the old object. Wait, `register` is async but has no await, so it runs synchronously. But `checkHealth` is async and mutates the provider object. If `register` replaces the provider object while `checkHealth` is running, `checkHealth` will continue mutating the old object, and the new one won't get the health update. Also, `getBest` returns a shallow copy, but `checkHealth` gets the reference from the map and mutates it.

Actually, looking at `register`: it's declared `async` but has no `await`. It will still return a Promise. Since it's synchronous in execution, it won't yield. But `checkHealth` yields at `fetch`. If `register` is called during that yield, it could replace the provider. Then when `checkHealth` resumes, it mutates the old provider object which is no longer in the map (or rather, the map has a new object). This is a real issue.

2. **`checkHealth` timeout leak on success**: In `checkHealth`, `clearTimeout(timeout)` is called after `await fetch(...)` resolves, but if `fetch` throws (e.g., network error), the catch block also calls `clearTimeout(timeout)`. However, if the fetch succeeds but the response is not ok and status >= 500, it throws `new Error(...)`. The catch block clears the timeout. That seems fine. But wait: what if `fetch` resolves after the timeout? The AbortController aborts the fetch, which causes `fetch` to throw an `AbortError`. The catch block handles it. But there's a subtle issue: `clearTimeout(timeout)` is called in both try and catch. However, if the function returns early or throws an uncaught exception before clearing? No, the only throw is in the try block for non-OK status, which is caught by the catch. But what about the case where `provider` is not found? That throws before the timeout is set, so no leak.

Wait, actually there's a potential issue: if `fetch` succeeds (response.ok or status < 500), `clearTimeout(timeout)` is called. But what if the code throws after `clearTimeout`? No, it returns. So the timeout is cleared.

But there's another issue: `response.ok || response.status < 500`. This means any status < 500 is considered healthy, including 404, 401, 403, etc. That seems wrong for a health check. A 404 might mean the health endpoint doesn't exist, but the code treats it as healthy. This is a logic bug. `response.ok` is status 200-299. `response.status < 500` includes 400-499. So 404 Not Found is treated as healthy. That's definitely a bug.

3. **`checkHealth` mutates provider object directly**: The provider object is stored in the Map. `getAll()` returns shallow copies, but `checkHealth` gets the reference and mutates it. If `register` is called with a new config for the same id while `checkHealth` is in flight, the old object is replaced. The health update goes to the old object. This is related to the race condition above.

4. **`checkAllHealth` uses `Promise.allSettled` but doesn't check results**: It just calls `getAll()` afterwards. But more importantly, `checkHealth` m

---

## AUD-14 — audit — `innomcp-node/src/services/fastPathHandler.ts` [zai-org/GLM-5.1]
| severity | location | issue | proposed fix |
|---|---|---|---|
| HIGH | `trigToDeg` | Nested trig calls produce malformed output: `sin(cos(45))` → `sin(cos(45)))` (extra `)`). The `[^)]+` capture stops at the first `)`, splitting the match incorrectly and injecting a stray paren on reassembly. | Use a recursive/balanced-paren parser instead of `[^)]+`, or at minimum skip conversion when the argument contains unmatched parens / nested calls. |
| MED | `DEFAULT_OPTS` | `Number(process.env.FASTPATH_MAX_TEXT_LEN \|\| 400)` — the `\|\|` treats env value `"0"` as falsy, falling back to `400`. Same for all other numeric env vars (`FASTPATH_MAX_WORK_MS`, `FASTPATH_EXTRA_TTL_MS`, etc.). | Use nullish coalescing: `Number(process.env.FASTPATH_MAX_TEXT_LEN ?? 400)` or parse first then default: `const v = Number(process.env...); isNaN(v) ? 400 : v`. |
| MED | `tryReadExtraFromFile` | Synchronous `fs.existsSync` + `fs.readFileSync` blocks the Node event loop inside an `async` function, defeating the purpose of async and adding latency to every cache refresh under load. | Replace with `fs.promises.access`/`fs.promises.readFile` (or `fs.promises.readFile` with try/catch for ENOENT). |
| MED | `handleFastPathMessage` (rate-limit block) | Rate limiting is gated on `if (clientIp)` — an empty string `""` (falsy) bypasses rate limiting entirely. Depends on caller always passing a non-empty string, which is fragile. | Change to `if (clientIp != null)` or validate that `clientIp` is a non-empty string before skipping. |
| LOW | `cleanFloat` | For `NaN` input, `Math.round(NaN * 1e10)` → `NaN`; `Number.isInteger(NaN)` → `false`; returns string `"NaN"` with no error signal. | Guard: `if (!Number.isFinite(val)) return String(val);` or throw/return a sentinel. |
| LOW | `getExtraPhrases` | Module-level `extraCache` singleton has no concurrency guard — two concurrent calls past TTL both refresh and write; the second overwrites the first. Data is valid so this is benign, but it causes duplicate I/O. | Use a single in-flight Promise (dedup pattern): store the refresh Promise and `await` it on concurrent calls. |
| LOW | `trigToDeg` | `mathjs.evaluate` is imported but the truncated code likely passes `trigToDeg` output to it. If `trigToDeg` produces a malformed string (see HIGH), `evaluate` will throw an unhandled parse error downstream. | Ensure the downstream evaluate call is wrapped in try/catch, and fix `trigToDeg` nesting bug. |

**Overall risk verdict: The `trigToDeg` nested-paren corruption is a real bug that will produce wrong output or crash downstream math evaluation; the `\|\|` vs `??` env-var default is a latent defect that silently ignores zero values.**

---

## AUD-15 — audit — `innomcp-node/src/services/naturalnessGuard.ts` [MiniMaxAI/MiniMax-M3]
```markdown
| severity | location | issue | proposed fix |
|---|---|---|---|
| MED | `checkNaturalness`, Rule 3 (`RAW_JSON_RE`) | `RAW_JSON_RE` anchors to `^\s*` against the *trimmed* candidate, so any leading preamble (e.g. `"สรุป: {...}"`) lets raw JSON leak into a visible answer; also fails to match JSON that starts with `{` followed by a non-`"` key (e.g. numeric/boolean key) because of the `\s*"` requirement. | Use a substring/lookahead scan like `/^\s*(?:[\{\[][\s\S]*[\}\]])\s*$/` for a pure-JSON answer, and additionally flag `/\n\s*[\{\[]\s*"/` mid-answer; or strip fenced JSON and re-run `JSON.parse` to detect. |
| MED | `checkNaturalness`, Rule 2 (`english-first-leak`) | Only inspects the first 50 chars for Thai (`trimmed.slice(0, 50)`). An answer like `"Sure! Here you go:\n\nแนะนำ..."` is a Thai answer but Rule 2 will still treat the first 50 chars as English-only and trigger a false positive. | Require Thai somewhere in the first N chars (e.g. any Thai char within first 200) AND leading with English without Thai preamble, or check that the first non-empty line contains Thai when the query is Thai. |
| MED | `checkNaturalness`, Rule 2 | `startsWithEnglish` uses `s.trim()`, but the subsequent `trimmed.slice(0, 50)` is taken from the already-trimmed string — fine — however leading invisible/zero-width characters (BOM `\uFEFF`, ZWJ, NBSP `\u00A0`) are not stripped, so `"\uFEFFHello…"` yields `startsWithEnglish=false` and the rule silently no-ops. | Strip `\uFEFF`, `\u200B–\u200D`, `\u00A0` before checking (e.g. normalize via `candidate.replace(/^[\s\uFEFF\u200B-\u200D\u00A0]+/, "")`). |
| MED | `checkNaturalness`, Rule 4/5 (delegation to `checkVisibleTextSafe`) | When `guard.ok === false` but `guard.forbiddenSubstring` is missing/empty, the fallback rule id becomes the generic `"guard-violation"` and the same generic Thai hint is used for both "Used tools: none" failures and map-placeholder leaks — the Stylist/Conductor cannot distinguish the cause and will retry the wrong thing. | Branch on `guard.ruleFired` / reason from `eventGuard` and return rule-specific ids + hints (e.g. `tools-none-when-expected`, `map-placeholder-leak`). |
| LOW | `checkNaturalness`, Rule 1 (`PROVINCE_REQUEST_RE`) | The pattern allows any trailing junk via `[^\n]*$`, so a malicious/garbage suffix like `"กรุณาระบุจังหวัด <script>…"` passes the check and is treated as a province-only answer. Likely intended to be tightly bounded. | Tighten to a curated allowlist of canned phrases, e.g. test against an explicit array of literal strings rather than a permissive regex; or require the whole string equal one of the known canned phrases. |
| LOW | `checkNaturalness`, Rule 6 (`planning-broad-too-shallow`) | Heuristic regex matches substrings inside long irrelevant prose (e.g. a code-switched English word like `"first-pass"` or `"criteria"` can satisfy `hasPlanFrame` even if the answer is otherwise shallow/empty of real guidance). Combined with `||`, a single English token discharges the rule. | Require at least one of the Thai markers (`แนวทาง|ปัจจัย|ขั้นตอน|วิธ���`) and a follow-up marker together, or require the plan-frame match to be Thai-script; also exclude matches inside backticks/code blocks. |
| LOW | `hasThaiCharacter` | Unicode range `[฀-๿]` is the Thai block, but it is inclusive of control/private chars at the low end (`฀` is U+0E00, the block starts there, OK) — however it does not cover Thai combining marks in the extension block (U+0E30–U+0E4B is included, but digits/letters outside this range, e.g. some Pali/Sanskrit extensions, are missed). Minor, but for a "is this Thai?" gate it can yield false negatives on loan words. | Document the assumption or broaden to `/[฀-๿\u0E50-\u0E59]/` (already covered) and explicitly handle extended blocks if needed. |
| LOW | `checkNaturalness` top | No handling for non-string `candidate` other than the falsy check; if a caller passes a `String` object (boxed) or a number that gets coerced via template, `c

---

## AUD-16 — audit — `innomcp-node/src/services/riskDetector.ts` [deepseek/deepseek-v4-flash]
| severity | location (function or approx line) | issue | proposed fix |
|----------|----------------------------------|-------|--------------|
| HIGH | `assessRisk` (line ~80) | No guard against `null`/`undefined` `command` – calling `.test()` on a non‑string throws a runtime `TypeError`, causing the entire agent backend to crash if the caller passes a malformed value (e.g., from an untrusted source). | Add an early return: `if (typeof command !== 'string' || command.length === 0) return { riskLevel: "low", reason: "", requiresApproval: false };` |
| MEDIUM | `HIGH_PATTERNS` (line ~20) & `assessRisk` (line ~82) | The pattern `/rm\s+(-r\|-f\|-rf\|-fr)/i` does **not** match flags separated by spaces (e.g., `rm -r -f /`). Such commands are instead caught by the `MEDIUM_PATTERNS` fallback `/rm\s+\S+/i` and classified as `"medium"` with an incorrect reason (“แก้ไขไฟล์หรือ install package”) instead of the appropriate `"high"` risk. This undermines the risk assessment accuracy. | Extend the regex to also handle multiple flags: `/rm\s+(-[rRfF]+)(\s+-[rRfF]+)*\s+/i` OR add a separate regex for spaced flags, or restructure the logic to detect any `rm` with `-r` and/or `-f` flags regardless of spacing. |

**Overall risk verdict:** One crash‑level defect (null input) and one misclassification defect that reduces security precision. Not critically broken, but the null guard is essential.

---

## AUD-17 — audit — `innomcp-node/src/services/answerContract.ts` [Qwen/Qwen3.7-Max]
| severity | location | issue | proposed fix |
|---|---|---|---|
| MED | `buildAnswerContract` (freshness logic) | If sources contain both "recent" and "stale" items (but no "live"), the logic falls through to `includes("recent")` and returns "recent", silently masking the presence of "stale" sources. Similarly, "live" + "recent" incorrectly returns purely "live". | Replace boolean flags with a Set to detect any mix: `const unique = new Set(freshnessValues); if (unique.size > 1) freshness = "mixed"; else if (unique.has("live")) freshness = "live"; ...` |
| MED | `buildAnswerContract` (return object) | Arrays (`sources`, `toolsUsed`, `memoryEntities`, `degradedReasons`) are assigned by direct reference from `params`. If the caller mutates these arrays post-creation, the "immutable" contract snapshot is silently altered. | Shallow copy all array properties in the return object (e.g., `sources: [...params.sources]`, `toolsUsed: [...params.toolsUsed]`). |
| LOW | `buildAnswerContract` (params validation) | `confidence` is accepted as any unbounded `number`. Passing values like `-0.5` or `1.2` will silently corrupt downstream analytics, routing, or UI components expecting a normalized 0.0–1.0 range. | Clamp the value during assignment: `confidence: Math.max(0, Math.min(1, params.confidence))` or throw a `RangeError` if strictly validating. |

Overall risk: LOW-MED; aggregate freshness logic masks stale sources and direct array references allow silent post-creation mutation of the contract snapshot.

---

## AUD-18 — audit — `innomcp-node/src/services/generalGate.ts` [moonshotai/Kimi-K2.6]
The user wants me to audit a TypeScript module from `innomcp-node/src/services/generalGate.ts` for real defects. I need to look for bugs, race conditions, unhandled rejections, missing error handling, resource leaks, incorrect async/await, edge cases (null/empty/malformed input), and silent failures.

Let me carefully analyze the provided code.

The module contains:
1. `LOW_CONFIDENCE_FALLBACK_TEXT` constant
2. `renderGeneralFallbackMessage()` - returns a string
3. `renderThaiNumberText(value: number)` - converts number to Thai text
4. `countDaysUntilEndOfYear(baseDate: Date)` - counts days until end of year
5. `renderGeneralSmokeAnswer(userText: string)` - pattern matching for smoke test answers

Let me analyze each function for defects:

**renderThaiNumberText(value: number):**
- Input validation: checks `!Number.isFinite(value)` - good, handles NaN and Infinity
- Checks `value === 0` - good
- Handles negative numbers recursively - good
- Handles millions: `value < 1000000` uses `renderChunk`, else splits into millions and remainder
- Wait, `renderChunk` is defined inside the function. Let's look at it carefully.
- `renderChunk(num: number)`:
  - If `num === 0` returns `""`
  - Splits into digits
  - For each digit, calculates position from right
  - Position 0 (units): handles "เอ็ด" case when digit is 1 and there are more digits. But wait, `pos === 0 && digit === 1 && digits.length > 1` - this condition is checked inside `if (pos === 0)`, so `pos === 0` is always true there. The check `pos === 0` is redundant but not harmful.
  - Position 1 (tens): handles 1 -> "สิบ", 2 -> "ยี่สิบ", else `units[digit] + "สิบ"`
  - Other positions: `units[digit] + positions[pos] || ""`
  
  Issues in `renderChunk`:
  - `positions` array has length 7: ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"]
  - For a 6-digit number (hundred thousands), `digits.length` is 6, so `pos` ranges from 5 to 0.
  - `pos = 5` -> `positions[5]` is "แสน" ✓
  - `pos = 6` -> `positions[6]` is "ล้าน" ✓
  - But what about numbers >= 1,000,000? The outer function handles millions separately.
  - What about `num` being 0? Returns "" which is fine for remainder.
  
  Wait, there's a bug with decimal numbers? The function uses `Math.floor(value)` for `value < 1000000`, but what if value is 1.5? `Math.floor(1.5)` = 1. But the function signature takes `number`, and doesn't explicitly handle non-integers except for the `!Number.isFinite` check. If someone passes 1.5, it gets floored implicitly. But wait, for the millions case: `Math.floor(value / 1000000)` and `Math.floor(value % 1000000)`. Actually `value % 1000000` for 1,500,000.5 would be 500,000.5, then `Math.floor` makes it 500,000. But the function doesn't document whether it handles decimals. The `Math.floor` suggests it expects integers but doesn't validate. Not necessarily a bug, but an edge case.

  More importantly: what about very large numbers? `value >= 1000000` is handled by splitting into millions and remainder. But what about billions? `renderChunk(millions)` where millions could be > 999. If value is 1,000,000,000, millions = 1000. `renderChunk(1000)` would process "1000" as digits [1,0,0,0], positions 3,2,1,0 -> "หนึ่งพัน". Then it appends "ล้าน". So 1,000,000,000 becomes "หนึ่งพันล้าน". That's actually correct in Thai. But what about trillions? It would be recursive in a way? No, it only handles one level of millions. So 1,000,000,000,000 (1 trillion) -> millions = 1,000,000, `renderChunk(1000000)` -> "หนึ่งล้าน", then append "ล้าน" -> "หนึ่งล้านล้าน". That's actually acceptable in Thai (though "ล้านล้าน" is used). But wait, `renderChunk(1000000)` calls `renderChunk` which for num=1000000 doesn't hit the `num < 1000000` check inside renderChunk because renderChunk doesn't have that check! Wait, renderChunk is called with `Math.floor(value)` for the < 1000000 case, but in the millions case, `renderChunk(millions)` is called where millions could be >= 1,000,000 if value >= 1,000,000,000,000. But `rende

---

## AUD-20 — audit — `innomcp-node/src/services/contextManager.ts` [MiniMaxAI/MiniMax-M3]
| severity | location | issue | proposed fix |
|---|---|---|---|
| MED | `trim` (lines ~62-83) | Only `messages[0]` is treated as the system message; subsequent system messages are dropped from output even though they were added via `addMessage`. | Iterate all messages: extract *all* `role === 'system'` into `systemMessages` and put the rest in `otherMessages`. |
| MED | `trim` (line ~73) | `messages.reduce(...)` re-counts tokens including system message(s) and then `totalTokens` is decremented as if removing from that total, but the system message is never in `otherMessages` to be shifted. Net effect: system token cost is never reclaimed, so `maxTokens` can be persistently exceeded by exactly the system message's token count. | Compute `totalTokens` only over `otherMessages` (or subtract `countTokens(system.content)` from the initial total). |
| MED | `trim` (line ~64) | `messages[0].role === 'system'` will throw `TypeError: Cannot read properties of undefined (reading 'role')` if a caller ever passes a sparse/empty array that bypasses the `length === 0` guard (e.g. `[undefined]`). Defensive but real — `access of possibly undefined`. | Use `messages[0]?.role === 'system'` or tighten guard `if (messages.length === 0 || !messages[0]) return [];`. |
| MED | `trim` (line ~78) | `otherMessages.shift()!` uses a non-null assertion inside `while (otherMessages.length > 0 ...)`; safe, but more importantly `totalTokens -= this.countTokens(removed.content)` will go **negative** if `msg.tokens` was set to a value smaller than the recount, or if `countTokens` is ever swapped for a different estimator — silently producing nonsense token counts that can loop oddly in future variants. | Cap at 0: `totalTokens = Math.max(0, totalTokens - this.countTokens(removed.content));` and prefer honoring the optional `msg.tokens` field if provided. |
| HIGH | `addMessage` (lines ~26-33) | No upper bound on session growth. `content` can be arbitrarily large, sessions are never evicted, and the in-memory `Map` leaks memory for every `sessionId` ever seen. In a long-running chat backend this is a DoS vector / memory leak. | Cap per-session message count (e.g. last N messages), bound individual `content` length, and expose a session TTL/LRU eviction policy. |
| HIGH | `countTokens` (line ~50) | Estimator is `Math.ceil(text.length / 4)` — a character-count proxy. Completely wrong for CJK/Thai text (the very languages the Thai comments indicate this product targets): a Thai or Japanese string of N characters encodes to roughly N tokens, not N/4, so real token usage will be **~4×** the budget and silently overflow the model's context window, causing upstream API 400s or truncation by the provider. | Use a real tokenizer (e.g. `tiktoken` / provider's tokenizer); at minimum apply a script-aware ratio (e.g. `cjk * 1 + ascii/4`). |
| HIGH | `summarize` (line ~90) | No length/token cap on the returned summary. A long session produces a multi-MB system message that itself blows `maxTokens` on the next `getContext` call — and because `trim` only removes from `otherMessages`, the oversized system message is permanently retained, guaranteeing the API call exceeds the model's limit. | Truncate `summaryContent` to a token budget, and have `trim` re-check system message size and shrink it if needed. |
| MED | `summarize` (line ~88) | `summarize` is exported only via the singleton but is never invoked from `getContext`/`trim`. The documented "summarize to fit" behavior is unimplemented, so the only mechanism to stay under `maxTokens` is lossy message deletion, not summarization. | Wire `summarize` into `trim` when trimming would discard meaningful context, or remove the dead method to avoid misleading callers. |
| LOW | `Message.tokens` (line ~4) | Field is declared but never read anywhere (`countTokens` always recomputes from `content`). Callers that pre-compute accurate token counts via a real tokenizer have their values silently ignored, defeating the purpose of the fie

---

## AUD-21 — audit — `innomcp-node/src/providers/router.ts` [deepseek/deepseek-v4-pro]
| severity | location | issue | proposed fix |
|----------|----------|-------|-------------|
| HIGH | `selectProvider` → `rank` closure (approx L102) | `rank(p)` uses `p.priority` directly. If a `ProviderRecord` has `priority` set to `undefined` (e.g. malformed registry entry), the addition yields `NaN`, which breaks `sort` order and can silently return an unintended top provider. | Guard with `(p.priority ?? 0)` or validate `priority` when providers are loaded. |
| MEDIUM | `resolveProviderEndpoint` (L134) | Calls `resolveApiKey(providerId)` synchronously. If `resolveApiKey` is asynchronous (returns a `Promise<string>`), `key` will be a Promise object, not the resolved string. Downstream consumers will receive a non-string key. | If `resolveApiKey` can be async, `resolveProviderEndpoint` must be async and `await` the call, or the API surface should enforce synchronous resolution. |
| MEDIUM | `resolveProviderEndpoint` (L138‑142) | Returns an object with `provider.baseUrl` and `provider.model` without checking whether they are defined. Incomplete registry entries could produce `{ url: undefined, key: …, model: undefined }`, which may cause silent failures or crashes later. | Validate that `baseUrl` and `model` are non-empty strings; return `null` or log a warning if they are missing. |
| MEDIUM | `matchesPrivacy` used by `selectProvider` (L49‑54) | Compares `p.privacyLevel` against string literals, but if `privacyLevel` is optional on `ProviderRecord` and is `undefined`, the condition `wanted === "internal"` would incorrectly pass (because `undefined !== "public"`), leaking providers that should be blocked. | If `privacyLevel` can be absent, treat missing as `"public"` or add an explicit `if (p.privacyLevel == null)` guard. |
| LOW | `previewSelection` / `selectProvider` (general) | None of the registry accessors (`listProviders`, `getProvider`, `resolveApiKey`) are wrapped in try/catch. Any internal error thrown by the registry module will propagate unhandled to the caller, which may crash the request if callers don’t expect exceptions. | Wrap registry calls in try/catch and return a safe fallback (e.g., `null` result with an error reason) to prevent unexpected crashes. |

**Overall risk verdict:** Module contains a concrete sorting bug (NaN) and several unvalidated assumptions (async key, missing fields, privacy guard) that can cause silent misbehaviour or runtime failures.

---

## AUD-22 — audit — `innomcp-node/src/providers/registry.ts` [deepseek/deepseek-v4-pro]
| severity | location (function or approx line) | issue | proposed fix |
|----------|------------------------------------|-------|---------------|
| MEDIUM   | `buildSeed()`, around line `const mdesUrl = process.env.OLLAMA_REMOTE_BASE_URL \|\| "https://ollama.mdes-innova.online"; if (mdesUrl) {...}` | The MDES remote provider is always seeded because `mdesUrl` defaults to a hardcoded URL, making the `if (mdesUrl)` guard always true. This contradicts the comment that the seed is optional and intended only when the env variable is present. It introduces a provider into the registry that may be unreachable and unconfigured, leading to unnecessary health checks and possible confusion. | Only seed when the environment variable is explicitly set: remove the default URL and use `const mdesUrl = process.env.OLLAMA_REMOTE_BASE_URL; if (mdesUrl) {...}`. |

**Overall risk verdict:** LOW — Only one logic defect that inadvertently registers a provider; no crash, security, or concurrency issues.

---

## AUD-23 — audit — `innomcp-node/src/geo/geo-tool-router.ts` [deepseek/deepseek-v4-pro]
| severity | location (function or approx line) | issue | proposed fix |
|----------|-----------------------------------|-------|---------------|
| HIGH | `route(intent: GeoIntentResult)` – start of method | No null/undefined guard on `intent`. Calling `intent.domain` throws a runtime TypeError if `intent` is `null` or `undefined`. | Add: `if (intent == null) return null;` before destructuring. |
| HIGH | `route` – line `const { features, subdomain } = intent;` | No check that `intent.features` exists. Accessing `features.has_coords` will throw if `features` is missing or null. | Add guard: `const features = intent.features; if (!features) return null;` before using `features`. |
| MEDIUM | `route` – confidence check `intent.confidence < 0.6` | When `intent.confidence` is `undefined`, the expression evaluates to `false`, so the request is **not** rejected and proceeds as if confidence is high. This bypasses the low‑confidence guard. | Store confidence in a variable and treat missing as `0` (e.g. `const conf = intent.confidence ?? 0; if (conf < 0.6) return null;`). |
| LOW | `route` – `const place = features.location_terms.join(" ");` | If `location_terms` contains empty strings or whitespace‑only elements, `place` can become a whitespace‑only string (e.g. `"   "`). Downstream tool calls would receive an invalid location/place value. | Filter out empty/whitespace terms: `features.location_terms.filter(t => t.trim()).join(" ")` and recheck `hasPlace` based on the filtered array. |

**Overall risk verdict:** Moderate – lacking input guards on `intent` and `features` may lead to unhandled runtime crashes; otherwise routing logic is straightforward.

---

## AUD-24 — audit — `innomcp-node/src/geo/geo-service.ts` [zai-org/GLM-5.1]
| severity | location | issue | proposed fix |
|----------|----------|-------|--------------|
| HIGH | `handleRequest` (primary execution) | If `this.guard.executeWithGuard` or `this.dispatch` throws an exception instead of returning an object with an `.error` property, the entire method rejects immediately, completely bypassing the fallback logic. | Wrap the primary and fallback `await this.guard.executeWithGuard(...)` calls in a `try/catch` block, treating caught exceptions as failed attempts so fallbacks can execute. |
| MED | `handleRequest` (fallback loop) | If `plan.fallbacks` is `undefined` or `null` (e.g., router returns a plan with no fallbacks), `for (const fb of plan.fallbacks)` throws a `TypeError`, crashing the request after the primary tool fails. | Default to an empty array: `for (const fb of plan.fallbacks ?? [])` |
| MED | `handleRequest` (final return) | Returning `rawPacket` directly on total failure bypasses `this.aggregator.format()`, risking an inconsistent response shape that violates the `WeatherPacket` interface contract. | Return a standardized error `WeatherPacket` or format `rawPacket` via `this.aggregator.format(rawPacket)` before returning. |
| MED | `handleRequest` (intent check) | If `this.intent.analyze(userMessage)` returns `null` or `undefined`, accessing `intentResult.domain` throws a `TypeError`. | Add a null check: `if (!intentResult \|\| intentResult.domain !== "weather" \|\| ...)` |
| LOW | `handleRequest` (packet checks) | If `executeWithGuard` returns `null`/`undefined`, `!rawPacket.error` or `!fbPacket.error` throws a `TypeError`. | Use optional chaining or explicit null checks: `if (rawPacket && !rawPacket.error)` |

Overall risk verdict: Unhandled exceptions in tool dispatch will silently bypass fallback mechanisms, causing unexpected request failures and missing fallback coverage.