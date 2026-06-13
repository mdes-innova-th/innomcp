<!-- cc-team deliverable
 group: GA (Concrete fix-proposals for the 4 known innomcp gaps)
 member: GAP-TOOLS role=gap-fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":178,"completion_tokens":2836,"total_tokens":3014,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1458,"image_tokens":0},"cache_creation_input_tokens":0} | 36s
 generated: 2026-06-13T11:10:59.536Z -->
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
    const content = req.body.payload?.content || message.slice('/write-doc'.length).trim();
    const docResult = await docWriterTool.invoke({ content });
    return res.json({ type: 'document', url: docResult.url });
  }

  // ... existing LLM agent logic
});
```

### 3. Ensure MCP Tools Are Correctly Registered (No code change)
- Verify that `innomcp-server-node` registers `storageTool`, `docWriterTool`, `audioTranscribeTool` with correct names and that the client in `innomcp-node` can call them (confirm tool listings). If not, adjust registration accordingly – but the gap states they are registered.

## Verification / Smoke‑Test Plan

1. **Audio Transcription**
   - Open chat page → click 🎤 → select a short `.wav`/`.mp3` file.
   - Expect: a new chat message appears with the transcribed text within ~5 seconds.
   - Check backend logs: file temporary storage used, `audioTranscribeTool` invoked.

2. **Document Writing**
   - Have a conversation that generates a substantial assistant response.
   - Click “📄” (Write Document).
   - Expect: a document download link or inline preview appears in chat (e.g., “Document saved: /files/doc123.md”).
   - Verify `docWriterTool` was called with the assistant’s text.

3. **File Storage (storageTool)**
   - Minimal addition: reuse the same file‑upload button but with a different intent (e.g., “Upload to Storage”).
   - Upload any file; expect success message showing file ID or path from `storageTool` (e.g., `storage.store`).
   - Alternatively, if storageTool supports listing, add a “Browse Storage” button that fetches file list and displays in chat.

All flows now exercise the MCP tools through the polished chat UI, closing the known gap.
