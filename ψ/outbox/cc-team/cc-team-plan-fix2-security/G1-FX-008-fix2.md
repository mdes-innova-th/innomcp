<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from security)
 member: FX-008 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2449,"completion_tokens":5659,"total_tokens":8108,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4732,"image_tokens":0},"cache_creation_input_tokens":0} | 60s
 generated: 2026-06-13T11:34:38.219Z -->
FILE: innomcp-node/src/services/hotRetriever.ts
<<<<<<< SEARCH
        content: typeof item === "string" ? item : JSON.stringify(item),
=======
        content: sanitizeContent(typeof item === "string" ? item : JSON.stringify(item)),
>>>>>>> REPLACE

FILE: innomcp-node/src/services/hotRetriever.ts
<<<<<<< SEARCH
      content: typeof results === "string" ? results : JSON.stringify(results),
=======
      content: sanitizeContent(typeof results === "string" ? results : JSON.stringify(results)),
>>>>>>> REPLACE

FILE: innomcp-node/src/services/hotRetriever.ts
<<<<<<< SEARCH
    content: typeof data === "string" ? data : JSON.stringify(data),
=======
    content: sanitizeContent(typeof data === "string" ? data : JSON.stringify(data)),
>>>>>>> REPLACE

FILE: innomcp-node/src/services/hotRetriever.ts
<<<<<<< SEARCH
    content: typeof result === "string" ? result : String(result),
=======
    content: sanitizeContent(typeof result === "string" ? result : String(result)),
>>>>>>> REPLACE

FILE: innomcp-node/src/services/hotRetriever.ts
<<<<<<< SEARCH
export function composeFactSummary(facts: RetrievalFact[]): string {
  if (facts.length === 0) return "";

  const lines: string[] = [];
  for (const fact of facts) {
    const sourceLabel = `[${fact.source.name}]`;
    // Truncate long content
    const content = fact.content.length > 500
      ? fact.content.slice(0, 500) + "..."
      : fact.content;
    lines.push(`${sourceLabel} ${content}`);
  }

  return lines.join("\n\n");
}
=======
export function composeFactSummary(facts: RetrievalFact[]): string {
  if (facts.length === 0) return "";

  const parts: string[] = [];
  for (const fact of facts) {
    const truncated = fact.content.length > 500
      ? fact.content.slice(0, 500) + "..."
      : fact.content;
    // Wrap each fact in an XML element to provide clear user-data boundaries
    parts.push(`<fact source="${fact.source.name}">${truncated}</fact>`);
  }

  return `<facts>\n${parts.join('\n')}\n</facts>`;
}
>>>>>>> REPLACE

FILE: innomcp-node/src/services/hotRetriever.ts
<<<<<<< SEARCH
function extractISP(query: string): string | null {
  const m = query.match(/\b(ais|dtac|ดีแทค|true|ทรู|trueonline|truemove|nt\b|cat\b|tot\b|3bb|เอไอเอส|ทีโอที)\b/i);
  return m ? m[1].toUpperCase() : null;
}
=======
function extractISP(query: string): string | null {
  const m = query.match(/\b(ais|dtac|ดีแทค|true|ทรู|trueonline|truemove|nt\b|cat\b|tot\b|3bb|เอไอเอส|ทีโอที)\b/i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Sanitize raw content for safe insertion into LLM context.
 * Escapes XML special characters and neutralises common prompt-injection
 * delimiters so that tool results cannot be misinterpreted as instructions.
 */
function sanitizeContent(raw: string): string {
  let safe = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Neutralise triple backticks (code fences) that could break out of formatting
  safe = safe.replace(/```/g, '(code)');
  // Escape Markdown heading patterns that could be used to inject instructions
  safe = safe.replace(/^###/gm, '\\###');
  // Escape conversational role prefixes
  safe = safe.replace(/^(User|Assistant|System):/gm, '\\$1:');
  return safe;
}
>>>>>>> REPLACE
