/**
 * services/providerAdapter.ts — Phase 3 provider HTTP adapter
 *
 * Routes actual API calls to GPT/Claude/Ollama through the provider registry.
 * Supports both non-streaming (callProvider) and streaming (streamProvider).
 *
 * Hard rule: API keys are NEVER logged. resolveApiKey() from registry is used
 * to fetch key values at call time; they must not appear in any log output.
 */

import type { ProviderRecord } from "../providers/types";
import { resolveApiKey } from "../providers/registry";

// ─── Public types ────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AdapterRequest {
  messages: ChatMessage[];
  /** Override the provider's default model. */
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface AdapterChunk {
  type: "delta" | "done" | "error";
  delta?: string;
  error?: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Build an AbortController that auto-cancels after `timeoutMs` milliseconds.
 * Returns both the controller and a cleanup function to clear the timer.
 */
function buildAbortController(timeoutMs: number): {
  controller: AbortController;
  clearTimer: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, clearTimer: () => clearTimeout(timer) };
}

/** Resolve the API key for a provider, throwing if not found. */
function requireApiKey(provider: ProviderRecord): string {
  const key = resolveApiKey(provider.id);
  if (!key || key.length === 0) {
    throw new Error(`API key not configured for provider: ${provider.displayName}`);
  }
  return key;
}

// ─── OpenAI-compatible (GPT, Copilot) ─────────────────────────────────────

async function callOpenAI(
  provider: ProviderRecord,
  req: AdapterRequest
): Promise<string> {
  const apiKey = requireApiKey(provider);
  const model = req.model ?? provider.model;
  const { controller, clearTimer } = buildAbortController(provider.timeoutMs);

  try {
    const resp = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: req.messages,
        max_tokens: req.maxTokens ?? provider.maxTokens,
        temperature: req.temperature ?? provider.temperature,
        stream: false,
      }),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`OpenAI API error ${resp.status}: ${errorText}`);
    }

    const data = (await resp.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message?.content ?? "";
  } finally {
    clearTimer();
  }
}

async function streamOpenAI(
  provider: ProviderRecord,
  req: AdapterRequest,
  onChunk: (chunk: AdapterChunk) => void
): Promise<void> {
  const apiKey = requireApiKey(provider);
  const model = req.model ?? provider.model;
  const { controller, clearTimer } = buildAbortController(provider.timeoutMs);

  try {
    const resp = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: req.messages,
        max_tokens: req.maxTokens ?? provider.maxTokens,
        temperature: req.temperature ?? provider.temperature,
        stream: true,
      }),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      onChunk({ type: "error", error: `OpenAI API error ${resp.status}: ${errorText}` });
      return;
    }

    if (!resp.body) {
      onChunk({ type: "error", error: "No response body from OpenAI stream" });
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") break;
        try {
          const parsed = JSON.parse(payload) as {
            choices: Array<{ delta?: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) onChunk({ type: "delta", delta });
        } catch {
          // skip malformed SSE lines
        }
      }
    }

    onChunk({ type: "done" });
  } finally {
    clearTimer();
  }
}

// ─── Anthropic-compatible (Claude) ────────────────────────────────────────

async function callAnthropic(
  provider: ProviderRecord,
  req: AdapterRequest
): Promise<string> {
  const apiKey = requireApiKey(provider);
  const model = req.model ?? provider.model;
  const { controller, clearTimer } = buildAbortController(provider.timeoutMs);

  // Anthropic separates system messages from the messages array.
  const systemMessages = req.messages.filter((m) => m.role === "system");
  const userMessages = req.messages.filter((m) => m.role !== "system");
  const systemText =
    systemMessages.length > 0
      ? systemMessages.map((m) => m.content).join("\n\n")
      : undefined;

  try {
    const body: Record<string, unknown> = {
      model,
      messages: userMessages,
      max_tokens: req.maxTokens ?? provider.maxTokens ?? 1024,
    };
    if (systemText) body.system = systemText;
    if (req.temperature !== undefined) body.temperature = req.temperature;
    else if (provider.temperature !== undefined) body.temperature = provider.temperature;

    const resp = await fetch(`${provider.baseUrl}/v1/messages`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`Anthropic API error ${resp.status}: ${errorText}`);
    }

    const data = (await resp.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    return data.content?.[0]?.text ?? "";
  } finally {
    clearTimer();
  }
}

async function streamAnthropic(
  provider: ProviderRecord,
  req: AdapterRequest,
  onChunk: (chunk: AdapterChunk) => void
): Promise<void> {
  const apiKey = requireApiKey(provider);
  const model = req.model ?? provider.model;
  const { controller, clearTimer } = buildAbortController(provider.timeoutMs);

  const systemMessages = req.messages.filter((m) => m.role === "system");
  const userMessages = req.messages.filter((m) => m.role !== "system");
  const systemText =
    systemMessages.length > 0
      ? systemMessages.map((m) => m.content).join("\n\n")
      : undefined;

  try {
    const body: Record<string, unknown> = {
      model,
      messages: userMessages,
      max_tokens: req.maxTokens ?? provider.maxTokens ?? 1024,
      stream: true,
    };
    if (systemText) body.system = systemText;
    if (req.temperature !== undefined) body.temperature = req.temperature;
    else if (provider.temperature !== undefined) body.temperature = provider.temperature;

    const resp = await fetch(`${provider.baseUrl}/v1/messages`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      onChunk({ type: "error", error: `Anthropic API error ${resp.status}: ${errorText}` });
      return;
    }

    if (!resp.body) {
      onChunk({ type: "error", error: "No response body from Anthropic stream" });
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    // Anthropic SSE uses named events; only extract delta.text when
    // the preceding event line was "content_block_delta".
    let lastEventType = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith("event:")) {
          lastEventType = trimmed.slice(6).trim();
          continue;
        }

        if (trimmed.startsWith("data:")) {
          const payload = trimmed.slice(5).trim();
          if (!payload) continue;

          if (lastEventType === "content_block_delta") {
            try {
              const parsed = JSON.parse(payload) as {
                delta?: { type?: string; text?: string };
              };
              const text = parsed.delta?.text;
              if (text) onChunk({ type: "delta", delta: text });
            } catch {
              // skip malformed lines
            }
          }

          // Reset after consuming a data line
          lastEventType = "";
        }
      }
    }

    onChunk({ type: "done" });
  } finally {
    clearTimer();
  }
}

// ─── Ollama (local + remote) ─────────────────────────────────────────────────

async function callOllama(
  provider: ProviderRecord,
  req: AdapterRequest
): Promise<string> {
  const model = req.model ?? provider.model;
  const { controller, clearTimer } = buildAbortController(provider.timeoutMs);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Remote Ollama may require an API key
  if (provider.apiKeyRef) {
    const key = resolveApiKey(provider.id);
    if (key) headers["Authorization"] = `Bearer ${key}`;
  }

  try {
    const resp = await fetch(`${provider.baseUrl}/api/chat`, {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify({
        model,
        messages: req.messages,
        stream: false,
        options: {
          ...(req.temperature !== undefined
            ? { temperature: req.temperature }
            : provider.temperature !== undefined
            ? { temperature: provider.temperature }
            : {}),
          ...(req.maxTokens !== undefined
            ? { num_predict: req.maxTokens }
            : provider.maxTokens !== undefined
            ? { num_predict: provider.maxTokens }
            : {}),
        },
      }),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`Ollama API error ${resp.status}: ${errorText}`);
    }

    const data = (await resp.json()) as {
      message?: { content?: string };
    };
    return data.message?.content ?? "";
  } finally {
    clearTimer();
  }
}

async function streamOllama(
  provider: ProviderRecord,
  req: AdapterRequest,
  onChunk: (chunk: AdapterChunk) => void
): Promise<void> {
  const model = req.model ?? provider.model;
  const { controller, clearTimer } = buildAbortController(provider.timeoutMs);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (provider.apiKeyRef) {
    const key = resolveApiKey(provider.id);
    if (key) headers["Authorization"] = `Bearer ${key}`;
  }

  try {
    const resp = await fetch(`${provider.baseUrl}/api/chat`, {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify({
        model,
        messages: req.messages,
        stream: true,
        options: {
          ...(req.temperature !== undefined
            ? { temperature: req.temperature }
            : provider.temperature !== undefined
            ? { temperature: provider.temperature }
            : {}),
          ...(req.maxTokens !== undefined
            ? { num_predict: req.maxTokens }
            : provider.maxTokens !== undefined
            ? { num_predict: provider.maxTokens }
            : {}),
        },
      }),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      onChunk({ type: "error", error: `Ollama API error ${resp.status}: ${errorText}` });
      return;
    }

    if (!resp.body) {
      onChunk({ type: "error", error: "No response body from Ollama stream" });
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Ollama streams NDJSON — one JSON object per line
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as {
            message?: { content?: string };
            done?: boolean;
          };
          const content = parsed.message?.content;
          if (content) onChunk({ type: "delta", delta: content });
          if (parsed.done) {
            onChunk({ type: "done" });
            return;
          }
        } catch {
          // skip malformed lines
        }
      }
    }

    onChunk({ type: "done" });
  } finally {
    clearTimer();
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Non-streaming call to any registered provider.
 * Returns the full response text.
 */
export async function callProvider(
  provider: ProviderRecord,
  req: AdapterRequest
): Promise<string> {
  switch (provider.type) {
    case "openai-compatible":
      return callOpenAI(provider, req);
    case "anthropic-compatible":
      return callAnthropic(provider, req);
    case "ollama-local":
    case "ollama-remote":
      return callOllama(provider, req);
    case "custom":
      throw new Error(`Unsupported provider type: custom`);
    default: {
      const _exhaustive: never = provider.type;
      throw new Error(`Unknown provider type: ${_exhaustive}`);
    }
  }
}

/**
 * Streaming call to any registered provider.
 * Calls `onChunk` for each delta, then once with `{ type: "done" }`.
 */
export async function streamProvider(
  provider: ProviderRecord,
  req: AdapterRequest,
  onChunk: (chunk: AdapterChunk) => void
): Promise<void> {
  switch (provider.type) {
    case "openai-compatible":
      return streamOpenAI(provider, req, onChunk);
    case "anthropic-compatible":
      return streamAnthropic(provider, req, onChunk);
    case "ollama-local":
    case "ollama-remote":
      return streamOllama(provider, req, onChunk);
    case "custom":
      onChunk({ type: "error", error: "Unsupported provider type: custom" });
      return;
    default: {
      const _exhaustive: never = provider.type;
      onChunk({ type: "error", error: `Unknown provider type: ${_exhaustive}` });
    }
  }
}
