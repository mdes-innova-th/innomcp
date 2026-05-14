import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Audio Transcribe Tool — Whisper-based speech-to-text.
 *
 * Backends (in order of preference, picked at runtime):
 *  1) OpenAI Whisper API   — if OPENAI_API_KEY env is present
 *  2) MDES Whisper Gateway — if WHISPER_GATEWAY_URL env is present
 *  3) Graceful fallback    — returns a clear "no backend configured" message
 *
 * Input: file path (workspace-relative or absolute) OR base64 audio.
 * Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm, ogg, flac
 */

export const audioTranscribeToolSchema = z.object({
  audioPath: z.string().optional().describe("Path to audio file (workspace-relative or absolute)"),
  audioBase64: z.string().optional().describe("Base64-encoded audio bytes (with or without data: prefix)"),
  language: z.string().optional().describe("BCP-47 language hint (e.g. 'th', 'en'). Default: auto-detect"),
  prompt: z.string().optional().describe("Optional prompt to bias the transcription"),
});

export type AudioTranscribeInput = z.infer<typeof audioTranscribeToolSchema>;

const ALLOWED_EXTENSIONS = new Set([".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm", ".ogg", ".flac"]);
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB matches OpenAI Whisper hard limit

async function loadAudioBytes(input: AudioTranscribeInput): Promise<{ ok: true; bytes: Buffer; name: string; mime: string } | { ok: false; error: string }> {
  if (input.audioBase64) {
    const m = input.audioBase64.match(/^data:(audio\/[a-z0-9+.-]+);base64,(.+)$/i);
    const mime = m?.[1] ?? "audio/mpeg";
    const payload = m?.[2] ?? input.audioBase64;
    try {
      const bytes = Buffer.from(payload, "base64");
      if (bytes.length === 0) return { ok: false, error: "empty audio payload" };
      if (bytes.length > MAX_BYTES) return { ok: false, error: `audio too large (${bytes.length} bytes > ${MAX_BYTES})` };
      const ext = "." + (mime.split("/")[1]?.split(";")[0] || "mp3").replace("mpeg", "mp3");
      return { ok: true, bytes, name: `audio${ext}`, mime };
    } catch (e) {
      return { ok: false, error: `failed to decode base64: ${(e as Error).message}` };
    }
  }
  if (input.audioPath) {
    const ext = path.extname(input.audioPath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) return { ok: false, error: `unsupported extension ${ext}. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}` };
    try {
      const bytes = await fs.readFile(input.audioPath);
      if (bytes.length > MAX_BYTES) return { ok: false, error: `audio too large (${bytes.length} bytes > ${MAX_BYTES})` };
      const mime = `audio/${ext.slice(1).replace("mp3", "mpeg")}`;
      return { ok: true, bytes, name: path.basename(input.audioPath), mime };
    } catch (e) {
      return { ok: false, error: `failed to read ${input.audioPath}: ${(e as Error).message}` };
    }
  }
  return { ok: false, error: "either audioPath or audioBase64 is required" };
}

async function transcribeViaOpenAI(bytes: Buffer, name: string, mime: string, language?: string, prompt?: string): Promise<{ text: string; durationSec?: number; backend: string }> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const fd = new FormData();
  fd.append("file", new Blob([bytes as any], { type: mime }), name);
  fd.append("model", process.env.WHISPER_MODEL || "whisper-1");
  if (language) fd.append("language", language);
  if (prompt) fd.append("prompt", prompt);
  fd.append("response_format", "verbose_json");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd as any,
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI Whisper ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data: any = await res.json();
  return { text: String(data.text || ""), durationSec: data.duration, backend: "openai-whisper" };
}

async function transcribeViaGateway(bytes: Buffer, name: string, mime: string, language?: string, prompt?: string): Promise<{ text: string; durationSec?: number; backend: string }> {
  const url = process.env.WHISPER_GATEWAY_URL!.replace(/\/$/, "");
  const fd = new FormData();
  fd.append("file", new Blob([bytes as any], { type: mime }), name);
  if (language) fd.append("language", language);
  if (prompt) fd.append("prompt", prompt);
  const res = await fetch(`${url}/transcribe`, { method: "POST", body: fd as any });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`MDES Whisper Gateway ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data: any = await res.json();
  return { text: String(data.text || data.transcription || ""), durationSec: data.duration, backend: "mdes-whisper-gateway" };
}

export const audioTranscribeTool = {
  name: "audioTranscribeTool",
  description: `
หน้าที่: ถอดเสียงเป็นข้อความ (Speech-to-Text / STT) ด้วย Whisper
ใช้เมื่อ:
- ต้องการถอดเสียงจากไฟล์ MP3/MP4/M4A/WAV/OGG/WEBM/FLAC เป็นข้อความ
- บันทึกการประชุมเป็นข้อความสรุป
- แปลงเสียงพูดภาษาไทย/อังกฤษเป็นข้อความ
- ทำ subtitles / closed captions

รองรับ:
- ขนาดไฟล์สูงสุด 25 MB
- ภาษาไทย, อังกฤษ, และอีก 95+ ภาษา
- Auto-detect ภาษา หรือระบุภาษาเองได้

Backends (auto-picked):
- OpenAI Whisper API (ถ้ามี OPENAI_API_KEY)
- MDES Whisper Gateway (ถ้ามี WHISPER_GATEWAY_URL)

ตัวอย่าง:
- "ถอดเสียงจากไฟล์ meeting.mp3"
- "transcribe audio.wav language=th"
`,
  inputSchema: audioTranscribeToolSchema,
  execute: async (rawArgs: unknown) => {
    const parsed = audioTranscribeToolSchema.safeParse(rawArgs);
    if (!parsed.success) {
      const text = JSON.stringify({ success: false, error: "invalid input", details: parsed.error.issues });
      return { content: [{ type: "text" as const, text }], isError: true };
    }
    const input = parsed.data;

    const loaded = await loadAudioBytes(input);
    if (!loaded.ok) {
      const text = JSON.stringify({ success: false, error: loaded.error });
      return { content: [{ type: "text" as const, text }], isError: true };
    }

    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasGateway = !!process.env.WHISPER_GATEWAY_URL;
    if (!hasOpenAI && !hasGateway) {
      const text = JSON.stringify({
        success: false,
        error: "no transcription backend configured",
        hint: "set OPENAI_API_KEY or WHISPER_GATEWAY_URL in environment",
      });
      return { content: [{ type: "text" as const, text }], isError: true };
    }

    try {
      const result = hasOpenAI
        ? await transcribeViaOpenAI(loaded.bytes, loaded.name, loaded.mime, input.language, input.prompt)
        : await transcribeViaGateway(loaded.bytes, loaded.name, loaded.mime, input.language, input.prompt);

      const payload = {
        success: true,
        text: result.text,
        durationSec: result.durationSec,
        backend: result.backend,
        bytesIn: loaded.bytes.length,
        language: input.language || "auto",
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const text = JSON.stringify({ success: false, error: msg });
      return { content: [{ type: "text" as const, text }], isError: true };
    }
  },
};

export function registerAudioTranscribeTool(server: McpServer) {
  server.registerTool(
    audioTranscribeTool.name,
    {
      title: "Audio Transcribe Tool — ถอดเสียงเป็นข้อความ (Whisper STT)",
      description: audioTranscribeTool.description,
      inputSchema: audioTranscribeTool.inputSchema,
    },
    audioTranscribeTool.execute,
  );
}
