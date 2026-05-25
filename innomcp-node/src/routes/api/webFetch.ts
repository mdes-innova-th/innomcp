/**
 * routes/api/webFetch.ts — Web Fetch endpoint (Private Agent Studio)
 *
 * POST /api/fetch  { url, saveArtifact?, timeoutMs? }
 *   → FetchResult: { url, title, markdown, wordCount, fetchedAt, cached, artifactPath? }
 */

import { Router, Request, Response } from "express";
import * as path from "node:path";
import { webFetch } from "../../services/webFetchTool";

const router = Router();

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT
  ? path.resolve(process.env.WORKSPACE_ROOT)
  : path.resolve(process.cwd(), "../workspace");

// POST /api/fetch
router.post("/", async (req: Request, res: Response) => {
  const { url, saveArtifact = true, timeoutMs } = req.body as {
    url?: string;
    saveArtifact?: boolean;
    timeoutMs?: number;
  };

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url required" });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  const result = await webFetch(url, {
    workspaceRoot: WORKSPACE_ROOT,
    saveArtifact,
    timeoutMs: typeof timeoutMs === "number" ? timeoutMs : undefined,
  });

  if (result.error) {
    // SSRF / invalid — 400; network failure — still 400 (non-retryable from client side)
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
});

export default router;
