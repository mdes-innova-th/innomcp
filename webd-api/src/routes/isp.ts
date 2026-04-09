/**
 * ISP routes — Web-D domain (db_aces)
 *
 * Most ISP analytics require complex joins against db_aces that are
 * not yet designed.  These endpoints return 501 honestly so the
 * MCP adapter can report "not_supported" rather than fake data.
 */
import { Router, Request, Response } from "express";
import { getMode } from "../db";

const router = Router();

function scaffoldGuard(_req: Request, res: Response): boolean {
  if (getMode() === "scaffold") {
    res.status(503).json({
      ok: false, domain: "webd", status: "scaffold",
      message: "Web-D ISP database (db_aces) not yet connected.",
    });
    return true;
  }
  return false;
}

// ---- TOP ISP BACKLOG ----
router.get("/top-backlog", async (_req: Request, res: Response) => {
  if (scaffoldGuard(_req, res)) return;
  // ISP backlog analytics require a dedicated ISP table that is not yet mapped
  res.status(501).json({ ok: false, domain: "webd", metric: "isp_top_backlog", status: "not_supported", message: "ISP backlog query not yet implemented against db_aces" });
});

// ---- ISP REDUCTION RATE ----
router.get("/reduction-rate", async (_req: Request, res: Response) => {
  if (scaffoldGuard(_req, res)) return;
  res.status(501).json({ ok: false, domain: "webd", metric: "isp_reduction_rate", status: "not_supported", message: "ISP reduction rate query not yet implemented against db_aces" });
});

export default router;
