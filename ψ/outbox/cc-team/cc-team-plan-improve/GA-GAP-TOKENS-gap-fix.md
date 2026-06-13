<!-- cc-team deliverable
 group: GA (Concrete fix-proposals for the 4 known innomcp gaps)
 member: GAP-TOKENS role=gap-fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":174,"completion_tokens":1451,"total_tokens":1625,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":741,"image_tokens":0},"cache_creation_input_tokens":0} | 21s
 generated: 2026-06-13T11:10:44.154Z -->
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
