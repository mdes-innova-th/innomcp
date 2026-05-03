const MAX_STORED_TEXT_LENGTH = 12_000;
const MAX_STRUCTURED_STRING_LENGTH = 4_096;
const MAX_STRUCTURED_ARRAY_ITEMS = 20;

function trimLongText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}...`;
}

function isEphemeralAssetUrl(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("data:") || trimmed.startsWith("blob:");
}

function compactStringForStorage(key: string, value: string): string | undefined {
  if (!value) return value;

  if (key === "generatedImageBase64") return undefined;

  if ((key === "generatedImageUrl" || key === "qrCodeImage" || key === "url") && isEphemeralAssetUrl(value)) {
    return undefined;
  }

  if (key === "chartSvg" && value.length > 2_000) {
    return undefined;
  }

  if (isEphemeralAssetUrl(value) && value.length > 1_024) {
    return undefined;
  }

  if (key === "text" || key === "fullText" || key === "imagePrompt") {
    return trimLongText(value, MAX_STORED_TEXT_LENGTH);
  }

  if (value.length > MAX_STRUCTURED_STRING_LENGTH) {
    return trimLongText(value, MAX_STRUCTURED_STRING_LENGTH);
  }

  return value;
}

function compactValueForStorage(key: string, value: unknown, depth = 0): unknown {
  if (value === null || typeof value === "undefined") return value;

  if (typeof value === "string") {
    return compactStringForStorage(key, value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    if (depth > 5) return undefined;

    const items = value
      .slice(0, MAX_STRUCTURED_ARRAY_ITEMS)
      .map((item, index) => compactValueForStorage(`${key}[${index}]`, item, depth + 1))
      .filter((item) => typeof item !== "undefined");

    return items.length > 0 ? items : undefined;
  }

  if (typeof value === "object") {
    if (depth > 5) return undefined;

    const next: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      const compacted = compactValueForStorage(childKey, childValue, depth + 1);
      if (typeof compacted !== "undefined") {
        next[childKey] = compacted;
      }
    }

    return Object.keys(next).length > 0 ? next : undefined;
  }

  return undefined;
}

export function compactChatMessageForStorage(
  message: Record<string, unknown>,
  options?: { stripStructuredContent?: boolean }
): Record<string, unknown> | null {
  const sender = message.sender === "ai" ? "ai" : message.sender === "user" ? "user" : null;
  const text = typeof message.text === "string" ? message.text : "";

  if (!sender || !text.trim()) {
    return null;
  }

  const compacted: Record<string, unknown> = {
    sender,
    text: trimLongText(text, MAX_STORED_TEXT_LENGTH),
  };

  if (typeof message.fullText === "string") {
    const fullText = trimLongText(message.fullText, MAX_STORED_TEXT_LENGTH);
    if (fullText !== compacted.text) {
      compacted.fullText = fullText;
    }
  }

  if (Array.isArray(message.toolsUsed) && message.toolsUsed.length > 0) {
    compacted.toolsUsed = message.toolsUsed.slice(0, 20);
  }

  if (!options?.stripStructuredContent && message.structuredContent) {
    const structuredContent = compactValueForStorage("structuredContent", message.structuredContent);
    if (structuredContent && typeof structuredContent === "object") {
      compacted.structuredContent = structuredContent;
    }
  }

  if (message.fileInfo) {
    const fileInfo = compactValueForStorage("fileInfo", message.fileInfo);
    if (fileInfo && typeof fileInfo === "object") {
      compacted.fileInfo = fileInfo;
    }
  }

  return compacted;
}

export function compactChatMessagesForStorage(
  messages: Array<Record<string, unknown>>,
  maxMessages: number,
  options?: { stripStructuredContent?: boolean }
): Array<Record<string, unknown>> {
  return messages
    .slice(-maxMessages)
    .map((message) => compactChatMessageForStorage(message, options))
    .filter((message): message is Record<string, unknown> => Boolean(message));
}

export function buildChatTransportHistory(
  messages: Array<Record<string, unknown>>,
  maxMessages: number
): Array<{ sender: "user" | "ai"; text: string }> {
  return messages
    .slice(-maxMessages)
    .map((message) => {
      const sender = message.sender === "ai" ? "ai" : message.sender === "user" ? "user" : null;
      const text = typeof message.text === "string" ? message.text.trim() : "";
      if (!sender || !text) return null;
      return { sender, text };
    })
    .filter((message): message is { sender: "user" | "ai"; text: string } => Boolean(message));
}

export function isQuotaExceededError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "QuotaExceededError" || error.code === 22 || error.code === 1014;
  }

  if (error instanceof Error) {
    return /quota|exceeded the quota/i.test(error.message);
  }

  return false;
}