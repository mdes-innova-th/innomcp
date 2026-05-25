/**
 * routes/api/modelSettings.ts
 *
 * Ad-hoc model connection test — does NOT require a pre-registered provider.
 * Complements /api/ai/providers which tests by provider ID.
 *
 * Endpoints:
 *   POST  /api/model-settings/test     { baseUrl, apiKey?, modelName, provider }
 *   GET   /api/model-settings/providers
 */

import { Router } from "express";

const router = Router();

interface TestBody {
  baseUrl: string;
  apiKey?: string;
  modelName: string;
  provider: string;
}

interface TestResult {
  success: boolean;
  latencyMs: number;
  model?: string;
  sample?: string;
  error?: string;
}

// POST /api/model-settings/test
router.post("/test", async (req, res) => {
  const { baseUrl, apiKey, modelName, provider } = req.body as TestBody;

  if (!baseUrl || !modelName) {
    return res.status(400).json({ error: "baseUrl and modelName are required" });
  }

  const start = Date.now();

  try {
    // Normalise trailing slash
    const base = baseUrl.replace(/\/$/, "");
    const endpoint = `${base}/chat/completions`;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);

    let r: Response;
    try {
      r = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5,
          stream: false,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const latencyMs = Date.now() - start;

    if (!r.ok) {
      const body = await r.text().catch(() => "");
      const result: TestResult = {
        success: false,
        latencyMs,
        error: `HTTP ${r.status}: ${body.slice(0, 120)}`,
      };
      return res.json(result);
    }

    const json = (await r.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const sample = json?.choices?.[0]?.message?.content ?? "";
    const result: TestResult = {
      success: true,
      latencyMs,
      model: modelName,
      sample: sample.slice(0, 60),
    };
    return res.json(result);
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : String(err);
    const result: TestResult = {
      success: false,
      latencyMs: Date.now() - start,
      error: msg.slice(0, 120),
    };
    return res.json(result);
  }
});

// GET /api/model-settings/providers — preset list for the UI
router.get("/providers", (_req, res) => {
  res.json({
    providers: [
      {
        id: "mdes",
        label: "MDES Ollama Cloud",
        defaultUrl: "https://ollama.mdes-innova.online/v1",
        needsKey: true,
        defaultModel: "gemma3:12b",
      },
      {
        id: "ollama",
        label: "Ollama (Local)",
        defaultUrl: "http://localhost:11434/v1",
        needsKey: false,
        defaultModel: "llama3.2:latest",
      },
      {
        id: "lmstudio",
        label: "LM Studio",
        defaultUrl: "http://localhost:1234/v1",
        needsKey: false,
        defaultModel: "local-model",
      },
      {
        id: "vllm",
        label: "vLLM",
        defaultUrl: "http://localhost:8000/v1",
        needsKey: false,
        defaultModel: "meta-llama/Llama-3.2-8B",
      },
      {
        id: "openai",
        label: "OpenAI-compatible",
        defaultUrl: "https://api.openai.com/v1",
        needsKey: true,
        defaultModel: "gpt-4o-mini",
      },
      {
        id: "custom",
        label: "Custom HTTP",
        defaultUrl: "",
        needsKey: true,
        defaultModel: "",
      },
    ],
  });
});

export default router;
