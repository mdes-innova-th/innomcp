<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from improve)
 member: FX-004 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3661,"completion_tokens":4468,"total_tokens":8129,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3468,"image_tokens":0},"cache_creation_input_tokens":0} | 42s
 generated: 2026-06-13T11:32:19.667Z -->
FILE: innomcp-node/src/agents/motherDispatch.ts
<<<<<<< SEARCH
let _oracleToken: { token: string; expiresAt: number } | null = null;

async function getOracleToken(baseUrl: string, signal: AbortSignal): Promise<string | null> {
  const now = Date.now();
  if (_oracleToken && _oracleToken.expiresAt > now + 60_000) return _oracleToken.token;
  try {
    const res = await fetch(`${baseUrl}/api/auth/token?client_id=innomcp&role=user`, {
      method: "POST", signal,
    });
    if (!res.ok) return null;
    const data = await res.json() as { access_token?: string };
    const token = data.access_token ?? "";
    if (!token) return null;
    _oracleToken = { token, expiresAt: now + 23 * 3600 * 1000 };
    return token;
  } catch {
    return null;
  }
}
=======
let _oracleToken: { token: string; expiresAt: number } | null = null;
let _oracleTokenRequest: Promise<string | null> | null = null;

async function getOracleToken(baseUrl: string, signal: AbortSignal): Promise<string | null> {
  const now = Date.now();
  if (_oracleToken && _oracleToken.expiresAt > now + 60_000) return _oracleToken.token;
  if (_oracleTokenRequest) return _oracleTokenRequest;

  _oracleTokenRequest = (async () => {
    try {
      const res = await fetch(`${baseUrl}/api/auth/token?client_id=innomcp&role=user`, {
        method: "POST", signal,
      });
      if (!res.ok) throw new Error("auth token request failed");
      const data = await res.json() as { access_token?: string };
      const token = data.access_token ?? "";
      if (!token) throw new Error("no access token in response");
      _oracleToken = { token, expiresAt: Date.now() + 23 * 3600 * 1000 };
      return token;
    } catch {
      _oracleToken = null;
      return null;
    } finally {
      _oracleTokenRequest = null;
    }
  })();

  return _oracleTokenRequest;
}
>>>>>>> REPLACE

FILE: innomcp-node/src/agents/motherDispatch.ts
<<<<<<< SEARCH
  if (!res.ok) throw new Error(`innova-oracle: HTTP ${res.status}`);
=======
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      _oracleToken = null;
    }
    throw new Error(`innova-oracle: HTTP ${res.status}`);
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/agents/motherDispatch.ts
<<<<<<< SEARCH
  const data = await res.json() as Record<string, unknown>;
  const text = (data.context ?? data.result ?? data.text ?? "") as string;
  if (!text || typeof text !== "string") return JSON.stringify(data).slice(0, 800);
  return `[Oracle]\n${text.trim()}`;
=======
  let data: Record<string, unknown>;
  try {
    data = await res.json() as Record<string, unknown>;
  } catch {
    const raw = await res.text().catch(() => "");
    return `[Oracle: non-json response] ${raw.slice(0, 800)}`;
  }
  const text = (data.context ?? data.result ?? data.text ?? "") as string;
  if (!text || typeof text !== "string") return JSON.stringify(data).slice(0, 800);
  return `[Oracle]\n${text.trim()}`;
>>>>>>> REPLACE

FILE: innomcp-node/src/agents/motherDispatch.ts
<<<<<<< SEARCH
    kind: p.type === "ollama-local" || p.type === "ollama-remote" ? "ollama" :
          p.type === "anthropic-compatible" ? "anthropic" : "openai",
=======
    kind: (() => {
      if (p.type === "ollama-local" || p.type === "ollama-remote") return "ollama";
      if (p.type === "anthropic-compatible") return "anthropic";
      console.warn(`buildProviderConfigs: unknown provider type "${p.type}" for ${p.id}, defaulting to "openai"`);
      return "openai";
    })(),
>>>>>>> REPLACE
