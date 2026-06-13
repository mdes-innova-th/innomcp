import type { ToolRegistry, ToolSpec } from '../tools/registry';

/**
 * Agent events emitted by the plan-act-observe loop.
 *
 * Consumers (e.g., a workspace UI) can listen to these events to render steps,
 * tool calls, results, and final artefacts in real time.
 */
export type AgentEvent =
  | { type: 'plan'; text: string }
  | { type: 'tool_call'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; id: string; name: string; output: unknown }
  | { type: 'message'; content: string; role: 'assistant' }
  | { type: 'artifact'; content: string }
  | { type: 'done'; finalOutput?: string }
  | { type: 'error'; error: string };

/**
 * Standalone autonomous agent loop implementing plan‑act‑observe.
 *
 * The loop repeatedly calls the supplied {@link llm} with the conversation
 * history and the tool specifications obtained from {@link tools}. When the
 * LLM returns tool calls they are executed via the tool registry and results
 * are fed back into the conversation.  When the LLM produces a content
 * message without tool calls, the loop treats it as the final answer, yields
 * an artefact and a `done` event, and stops.
 *
 * The generator yields {@link AgentEvent} items that can be consumed to
 * drive a real‑time workspace (tool calls, results, messages, artefacts).
 *
 * @param opts.task            - The user’s task description (prompt).
 * @param opts.tools           - A registry that provides tool specifications
 *                               (`getToolSpecs`) and can execute a named
 *                               tool (`execute`).
 * @param opts.llm             - Function that accepts the current message
 *                               array and tool specifications and returns
 *                               either a content message or tool calls.
 * @param opts.maxSteps        - Safety limit for LLM iterations (default 8).
 * @param opts.signal          - Optional AbortSignal to cancel the loop.
 *
 * @yields AgentEvent items that describe progress, tool activity, artefacts,
 *         errors, and completion.
 */
export async function* runAgentLoop(opts: {
  task: string;
  tools: ToolRegistry;
  llm: (
    messages: Record<string, unknown>[],
    toolSpecs: ToolSpec[],
  ) => Promise<{
    content?: string;
    toolCalls?: { name: string; input: unknown }[];
  }>;
  maxSteps?: number;
  signal?: AbortSignal;
}): AsyncGenerator<AgentEvent, void, undefined> {
  const { task, tools, llm, maxSteps = 8, signal } = opts;

  // ---------- Initial plan event ----------
  yield { type: 'plan', text: `Starting task: ${task}` };

  // ---------- Conversation history ----------
  const messages: Record<string, unknown>[] = [
    { role: 'user', content: task },
  ];

  // Tool specifications are static (regenerated each call to be safe)
  const toolSpecs: ToolSpec[] = tools.getToolSpecs();

  let step = 0;
  let toolCallIdCounter = 0;

  // ---------- Main loop ----------
  while (step < maxSteps) {
    // Abort check before expensive operations
    if (signal?.aborted) {
      yield { type: 'error', error: 'Aborted' };
      return;
    }

    step++;

    let llmResponse: {
      content?: string;
      toolCalls?: { name: string; input: unknown }[];
    };

    try {
      llmResponse = await llm(messages, toolSpecs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'LLM call failed';
      yield { type: 'error', error: `LLM error: ${message}` };
      return;
    }

    // -------- Branch: tool calls present --------
    if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
      // Build assistant message with tool calls (standard format)
      const assistantMessage: Record<string, unknown> = {
        role: 'assistant',
        content: llmResponse.content ?? null,
        tool_calls: llmResponse.toolCalls.map((tc) => {
          const id = `tc_${toolCallIdCounter++}`;
          return { id, name: tc.name, arguments: JSON.stringify(tc.input) };
        }),
      };
      messages.push(assistantMessage);

      // Execute each tool sequentially (simplest implementation)
      for (const toolCall of assistantMessage.tool_calls as {
        id: string;
        name: string;
        arguments: string;
      }[]) {
        const { id, name } = toolCall;
        const input = JSON.parse(toolCall.arguments) as unknown;

        yield { type: 'tool_call', id, name, input };

        // Abort check before tool execution
        if (signal?.aborted) {
          yield { type: 'error', error: 'Aborted during tool execution' };
          return;
        }

        let output: unknown;
        try {
          output = await tools.execute(name, input);
        } catch (err: unknown) {
          const errMsg =
            err instanceof Error ? err.message : 'Tool execution failed';
          yield { type: 'error', error: `Tool ${name} error: ${errMsg}` };
          return;
        }

        yield { type: 'tool_result', id, name, output };

        // Store tool result message for LLM context
        messages.push({
          role: 'tool',
          tool_call_id: id,
          name,
          content:
            typeof output === 'string' ? output : JSON.stringify(output),
        });
      }

      // Continue to next LLM iteration (observation)
      continue;
    }

    // -------- Branch: no tool calls, content message --------
    if (llmResponse.content) {
      yield {
        type: 'message',
        content: llmResponse.content,
        role: 'assistant',
      };
      yield { type: 'artifact', content: llmResponse.content };
      yield { type: 'done', finalOutput: llmResponse.content };
      return;
    }

    // -------- Empty response --------
    yield { type: 'error', error: 'LLM returned empty response' };
    return;
  }

  // -------- Safety limit reached --------
  yield {
    type: 'error',
    error: `Max steps (${maxSteps}) reached without completion`,
  };
}
