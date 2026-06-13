<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-015 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3398,"completion_tokens":2042,"total_tokens":5440,"prompt_tokens_details":{"cached_tokens":3328,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1745,"image_tokens":0},"cache_creation_input_tokens":0} | 58s
 generated: 2026-06-13T11:59:17.048Z -->
FILE: innomcp-server-node/src/mcp/tools/evidenceTool.ts
<<<<<<< SEARCH
  try {
    const res = await fetch(`${DETECT_API_BASE}${path}`, {
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`DetectAPI ${res.status}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
=======
  try {
    const res = await fetch(`${DETECT_API_BASE}${path}`, {
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`DetectAPI ${res.status}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs} ms`, { cause: err });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
>>>>>>> REPLACE
