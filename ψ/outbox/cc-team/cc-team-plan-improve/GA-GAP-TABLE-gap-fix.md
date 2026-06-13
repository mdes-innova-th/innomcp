<!-- cc-team deliverable
 group: GA (Concrete fix-proposals for the 4 known innomcp gaps)
 member: GAP-TABLE role=gap-fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":199,"completion_tokens":3432,"total_tokens":3631,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2284,"image_tokens":0},"cache_creation_input_tokens":0} | 42s
 generated: 2026-06-13T11:11:05.248Z -->
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
  const output = ensureMarkdownTable(input);
  expect(output).toBe(
    '| name | val |\n| --- | --- |\n| A | 1 |\n| B | 2 |'
  );
});

test('passes through existing markdown table', () => {
  const md = '| x | y |\n|---|---|\n| a | b |';
  expect(ensureMarkdownTable(md)).toBe(md);
});
```

3. **Smoke test in local mode** – verify that no regression occurs with local AI; the stronger prompt works for all models.
