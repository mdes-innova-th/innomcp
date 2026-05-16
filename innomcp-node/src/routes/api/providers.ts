/**
 * routes/api/providers.ts — Phase C provider CRUD + route-preview
 *
 * Endpoints:
 *   GET    /api/ai/providers
 *   POST   /api/ai/providers
 *   PATCH  /api/ai/providers/:id
 *   DELETE /api/ai/providers/:id
 *   POST   /api/ai/providers/:id/test
 *   POST   /api/ai/providers/route-preview
 *
 * The list/create/update/delete responses NEVER include apiKey or
 * apiKeyEncrypted — only `hasApiKey: boolean`. The /test endpoint
 * stub returns a deterministic mock for now (real probing is a Phase
 * C-2.5 follow-up that needs per-type adapters).
 */

import { Router, Request, Response } from "express";
import {
  listProviders,
  getProvider,
  createProvider,
  updateProvider,
  deleteProvider,
  setHealth,
} from "../../providers/registry";
import { toPublicView } from "../../providers/types";
import { previewSelection } from "../../providers/router";
import type { ChatMode } from "../../providers/router";
import type { Capability, PrivacyLevel } from "../../providers/types";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  const items = listProviders().map(toPublicView);
  res.json({ items, count: items.length });
});

router.post("/", (req: Request, res: Response) => {
  try {
    const created = createProvider(req.body);
    res.status(201).json({ provider: toPublicView(created) });
  } catch (err: any) {
    res.status(400).json({ error: String(err?.message || err) });
  }
});

router.patch("/:id", (req: Request, res: Response) => {
  const id = req.params.id as string;
  const updated = updateProvider(id, req.body || {});
  if (!updated) return res.status(404).json({ error: "provider not found" });
  res.json({ provider: toPublicView(updated) });
});

router.delete("/:id", (req: Request, res: Response) => {
  const id = req.params.id as string;
  const ok = deleteProvider(id);
  if (!ok) return res.status(404).json({ error: "provider not found" });
  res.status(204).end();
});

/**
 * Stub test-connection endpoint. Marks the provider as `degraded` if the
 * URL is unreachable in a 3-second probe; `healthy` otherwise. Real
 * per-type protocol probes (Ollama /api/tags, OpenAI /v1/models, etc.)
 * are out of scope for this slice and tracked in TASK_GRAPH C-2.5.
 */
router.post("/:id/test", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const rec = getProvider(id);
  if (!rec) return res.status(404).json({ error: "provider not found" });

  const probeUrl = rec.baseUrl;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(rec.timeoutMs, 3_000));
  let healthy = false;
  let detail = "ทดสอบเฉพาะการเชื่อมต่อพื้นฐาน (stub)";
  try {
    const r = await fetch(probeUrl, { method: "GET", signal: controller.signal });
    healthy = r.status >= 200 && r.status < 500;
    detail = `HTTP ${r.status}`;
  } catch (err: any) {
    healthy = false;
    detail = err?.name === "AbortError" ? "หมดเวลา" : "เชื่อมต่อไม่ได้";
  } finally {
    clearTimeout(timer);
  }

  setHealth(id, healthy ? "healthy" : "degraded");
  res.json({
    provider: toPublicView(getProvider(id)!),
    probe: { ok: healthy, detail },
  });
});

router.post("/route-preview", (req: Request, res: Response) => {
  const body = (req.body || {}) as {
    mode?: ChatMode;
    capabilities?: Capability[];
    privacyLevel?: PrivacyLevel;
  };
  const mode: ChatMode = body.mode || "local";
  const capabilities: Capability[] = Array.isArray(body.capabilities) ? body.capabilities : ["thai-naturalness"];
  const privacyLevel: PrivacyLevel | undefined = body.privacyLevel;
  const result = previewSelection({ mode, capabilities, privacyLevel });
  res.json(result);
});

export default router;
