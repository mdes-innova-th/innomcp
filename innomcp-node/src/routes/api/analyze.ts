/**
 * routes/api/analyze.ts — Data Analysis endpoint (Private Agent Studio)
 *
 * POST /api/analyze  { csv?: string, filePath?: string }
 *   → AnalysisResult: { rowCount, colCount, columns, summary, chartSvg?, artifactPath? }
 */

import { Router } from "express";
import { analyzeData } from "../../services/dataAnalysisTool";
import * as path from "node:path";

const router = Router();

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT
  ? path.resolve(process.env.WORKSPACE_ROOT)
  : path.resolve(process.cwd(), "../workspace");

// POST /api/analyze
router.post("/", async (req, res) => {
  const { csv, filePath } = req.body as { csv?: string; filePath?: string };
  if (!csv && !filePath) return res.status(400).json({ error: "csv content or filePath required" });
  try {
    const result = await analyzeData(
      filePath ? { path: filePath, workspaceRoot: WORKSPACE_ROOT } : (csv as string),
      { workspaceRoot: WORKSPACE_ROOT }
    );
    res.json(result);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Analysis failed" });
  }
});

export default router;
