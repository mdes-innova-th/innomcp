// src/app/api/chat/export/route.ts
import { NextRequest } from "next/server";
import { ReadableStream } from "stream/web";

interface ChatMessage {
  sender: "user" | "ai";
  text: string;
  timestamp?: number;
}

interface ExportRequest {
  messages: ChatMessage[];
  format: "markdown" | "json" | "txt";
  title?: string;
}

const VALID_FORMATS = ["markdown", "json", "txt"] as const;
type Format = (typeof VALID_FORMATS)[number];

function isValidFormat(value: unknown): value is Format {
  return typeof value === "string" && VALID_FORMATS.includes(value as Format);
}

function validateMessages(messages: unknown): messages is ChatMessage[] {
  if (!Array.isArray(messages)) return false;
  for (const msg of messages) {
    if (typeof msg !== "object" || msg === null) return false;
    if (typeof (msg as any).text !== "string") return false;
    const sender = (msg as any).sender;
    if (sender !== "user" && sender !== "ai") return false;
  }
  return true;
}

function getFilename(ext: string): string {
  const timestamp = Date.now();
  return `innomcp-chat-${timestamp}.${ext}`;
}

function getContentType(format: Format): string {
  switch (format) {
    case "markdown":
      return "text/markdown; charset=utf-8";
    case "json":
      return "application/json; charset=utf-8";
    case "txt":
      return "text/plain; charset=utf-8";
  }
}

function getExtension(format: Format): string {
  switch (format) {
    case "markdown":
      return "md";
    case "json":
      return "json";
    case "txt":
      return "txt";
  }
}

async function* markdownStream(messages: ChatMessage[], title: string) {
  const encoder = new TextEncoder();
  yield encoder.encode(`# ${title || "Untitled"}\n\n`);
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.sender === "user") {
      yield encoder.encode(`**User**: ${msg.text}\n\n`);
      // Look ahead for ai response
      if (i + 1 < messages.length && messages[i + 1].sender === "ai") {
        const aiMsg = messages[i + 1];
        yield encoder.encode(`**AI**: ${aiMsg.text}\n\n---\n`);
        i++; // skip the next as it's already handled
      } else {
        yield encoder.encode(`---\n`);
      }
    } else {
      // if an ai message appears without a preceding user (edge case)
      yield encoder.encode(`**AI**: ${msg.text}\n\n---\n`);
    }
  }
}

async function* jsonStream(messages: ChatMessage[]) {
  const encoder = new TextEncoder();
  const json = JSON.stringify(messages, null, 2);
  yield encoder.encode(json);
}

async function* txtStream(messages: ChatMessage[]) {
  const encoder = new TextEncoder();
  for (const msg of messages) {
    const label = msg.sender === "user" ? "User" : "AI";
    yield encoder.encode(`${label}: ${msg.text}\n`);
  }
  yield encoder.encode("---\n");
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return new Response("Invalid JSON body", { status: 400 });
    }

    const { messages, format, title } = body as ExportRequest;

    if (!validateMessages(messages)) {
      return new Response(
        "Invalid messages array. Expected {sender: 'user'|'ai', text: string}",
        { status: 400 }
      );
    }

    if (!isValidFormat(format)) {
      return new Response(
        `Invalid format. Accepted: ${VALID_FORMATS.join(", ")}`,
        { status: 400 }
      );
    }

    const ext = getExtension(format);
    const contentType = getContentType(format);
    const filename = getFilename(ext);
    const safeTitle = typeof title === "string" && title.trim() ? title : "Untitled";

    let generator: AsyncGenerator<Uint8Array, void, undefined>;

    switch (format) {
      case "markdown":
        generator = markdownStream(messages, safeTitle);
        break;
      case "json":
        generator = jsonStream(messages);
        break;
      case "txt":
        generator = txtStream(messages);
        break;
      default:
        return new Response("Unsupported format", { status: 400 });
    }

    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await generator.next();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      },
    });

    return new Response(stream as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export chat error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}