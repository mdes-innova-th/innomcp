<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-010 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3377,"completion_tokens":6880,"total_tokens":10257,"prompt_tokens_details":{"cached_tokens":3328,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4490,"image_tokens":0},"cache_creation_input_tokens":0} | 58s
 generated: 2026-06-13T11:59:09.115Z -->
FILE: innomcp-server-node/src/mcp/tools/audioTranscribeTool.ts
<<<<<<< SEARCH
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
=======
  if (input.audioBase64) {
    const m = input.audioBase64.match(/^data:(audio\/[a-z0-9+.-]+);base64,(.+)$/i);
    const mime = m?.[1] ?? "audio/mpeg";
    const payload = m?.[2] ?? input.audioBase64;
    // Estimate decoded size to reject huge payloads before allocating memory
    const estimatedLen = Math.ceil((payload.length * 3) / 4);
    if (estimatedLen > MAX_BYTES) {
      return { ok: false, error: `audio too large (estimated ${estimatedLen} bytes > ${MAX_BYTES})` };
    }
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
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/audioTranscribeTool.ts
<<<<<<< SEARCH
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
=======
  if (input.audioPath) {
    const workspaceRoot = path.resolve(process.env.WORKSPACE_ROOT || process.cwd());
    const filePath = path.resolve(input.audioPath);
    if (!filePath.startsWith(workspaceRoot + path.sep) && filePath !== workspaceRoot) {
      return { ok: false, error: "path traversal detected" };
    }
    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) return { ok: false, error: `unsupported extension ${ext}. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}` };
    try {
      const stat = await fs.stat(filePath);
      if (stat.size > MAX_BYTES) return { ok: false, error: `audio too large (${stat.size} bytes > ${MAX_BYTES})` };
      const bytes = await fs.readFile(filePath);
      const mime = `audio/${ext.slice(1).replace("mp3", "mpeg")}`;
      return { ok: true, bytes, name: path.basename(filePath), mime };
    } catch (e) {
      return { ok: false, error: `failed to read ${filePath}: ${(e as Error).message}` };
    }
  }
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/audioTranscribeTool.ts
<<<<<<< SEARCH
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
=======
async function transcribeViaOpenAI(bytes: Buffer, name: string, mime: string, language?: string, prompt?: string): Promise<{ text: string; durationSec?: number; backend: string }> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const fd = new FormData();
  fd.append("file", new Blob([bytes as any], { type: mime }), name);
  fd.append("model", process.env.WHISPER_MODEL || "whisper-1");
  if (language) fd.append("language", language);
  if (prompt) fd.append("prompt", prompt);
  fd.append("response_format", "verbose_json");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd as any,
      signal: controller.signal,
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`OpenAI Whisper ${res.status}: ${errBody.slice(0, 200)}`);
    }
    const data: any = await res.json();
    return { text: String(data.text || ""), durationSec: data.duration, backend: "openai-whisper" };
  } finally {
    clearTimeout(timeout);
  }
}
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/audioTranscribeTool.ts
<<<<<<< SEARCH
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
=======
async function transcribeViaGateway(bytes: Buffer, name: string, mime: string, language?: string, prompt?: string): Promise<{ text: string; durationSec?: number; backend: string }> {
  const url = process.env.WHISPER_GATEWAY_URL!.replace(/\/$/, "");
  const fd = new FormData();
  fd.append("file", new Blob([bytes as any], { type: mime }), name);
  if (language) fd.append("language", language);
  if (prompt) fd.append("prompt", prompt);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(`${url}/transcribe`, { method: "POST", body: fd as any, signal: controller.signal });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`MDES Whisper Gateway ${res.status}: ${errBody.slice(0, 200)}`);
    }
    const data: any = await res.json();
    const transcription = data.text || data.transcription;
    if (!transcription || typeof transcription !== "string" || transcription.trim().length === 0) {
      throw new Error(`MDES Whisper Gateway returned missing or empty transcription: ${JSON.stringify(data)}`);
    }
    return { text: String(transcription), durationSec: data.duration, backend: "mdes-whisper-gateway" };
  } finally {
    clearTimeout(timeout);
  }
}
>>>>>>> REPLACE
