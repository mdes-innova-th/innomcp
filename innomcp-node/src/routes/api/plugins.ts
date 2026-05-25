/**
 * routes/api/plugins.ts — Plugin Registry API
 *
 * GET  /api/plugins        → { plugins: Plugin[] }
 * PATCH /api/plugins/:id   → { enabled: boolean } → { plugin: Plugin }
 *
 * Mounted in app.ts at: app.use("/api/plugins", generalRateLimit, pluginsRouter)
 */

import { Router, Request, Response } from "express";
import {
  ensureBuiltIns,
  listPlugins,
  togglePlugin,
} from "../../plugins/registry";

// Seed built-ins on first import of this route module
ensureBuiltIns();

const router = Router();

// GET /api/plugins
router.get("/", (_req: Request, res: Response) => {
  res.json({ plugins: listPlugins() });
});

// PATCH /api/plugins/:id
router.patch("/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { enabled } = req.body as { enabled?: boolean };

  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "enabled (boolean) is required" });
  }

  const updated = togglePlugin(id, enabled);
  if (!updated) {
    return res.status(404).json({ error: `Plugin '${id}' not found` });
  }

  res.json({ plugin: updated });
});

export default router;
