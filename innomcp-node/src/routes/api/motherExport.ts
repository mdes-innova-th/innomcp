/**
 * routes/api/motherExport.ts — Export mother dispatch run responses
 *
 * GET /api/mother/export/:runId         — JSON export of a single run
 * GET /api/mother/export/:runId/csv     — CSV export of a single run
 * GET /api/mother/export/latest         — JSON export of the most recent run
 */

import { Router, Request, Response } from "express";
import { getRunById, getHistory } from "../../services/motherHistory";

const router = Router();

function runToRows(run: ReturnType<typeof getRunById>) {
  if (!run) return [];
  return run.providers.map((p) => ({
    runId: run.runId,
    timestamp: run.timestamp,
    query: run.query,
    providerId: p.providerId,
    providerName: p.providerName,
    latencyMs: p.latencyMs,
    success: p.success,
    preview: p.preview,
    errorMsg: p.errorMsg ?? "",
    isFastest: p.providerId === run.fastestProvider,
  }));
}

function toCSV(rows: ReturnType<typeof runToRows>): string {
  if (rows.length === 0) return "runId,timestamp,query,providerId,providerName,latencyMs,success,preview,errorMsg,isFastest\n";
  const header = Object.keys(rows[0]).join(",");
  const lines = rows.map((r) =>
    Object.values(r).map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
  );
  return [header, ...lines].join("\n");
}

router.get("/latest", (_req: Request, res: Response): void => {
  const runs = getHistory(1);
  if (runs.length === 0) {
    res.status(404).json({ error: "No runs yet" });
    return;
  }
  const rows = runToRows(runs[0]);
  res.json({ run: runs[0], rows, exportedAt: new Date().toISOString() });
});

router.get("/:runId", (req: Request, res: Response): void => {
  const { runId } = req.params;
  if (!runId || !/^[a-zA-Z0-9_-]{1,128}$/.test(runId)) {
    res.status(400).json({ error: "invalid runId" });
    return;
  }
  const run = getRunById(runId);
  if (!run) {
    res.status(404).json({ error: "run not found" });
    return;
  }
  const rows = runToRows(run);
  res.json({ run, rows, exportedAt: new Date().toISOString() });
});

router.get("/:runId/csv", (req: Request, res: Response): void => {
  const { runId } = req.params;
  if (!runId || !/^[a-zA-Z0-9_-]{1,128}$/.test(runId)) {
    res.status(400).json({ error: "invalid runId" });
    return;
  }
  const run = getRunById(runId);
  if (!run) {
    res.status(404).json({ error: "run not found" });
    return;
  }
  const csv = toCSV(runToRows(run));
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="mother-run-${runId}.csv"`);
  res.send(csv);
});

export default router;
