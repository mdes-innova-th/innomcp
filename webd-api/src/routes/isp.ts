/**
 * ISP routes — Web-D domain (db_aces / detect_bridge)
 *
 * In detect_bridge mode, ISP analytics are derived from detect.nip table:
 * - Top backlog: ISPs ranked by number of unblocked URLs (status_open='Y')
 * - Reduction rate: blocked vs total ratio per ISP
 *
 * In normal db_aces mode, these return 501 until proper ISP tables are mapped.
 */
import { Router, Request, Response } from "express";
import { query, getMode, isDetectBridge } from "../db";

const router = Router();

function scaffoldGuard(_req: Request, res: Response): boolean {
  if (getMode() === "scaffold") {
    res.status(503).json({
      ok: false, domain: "webd", status: "scaffold",
      message: "Web-D ISP database not yet connected.",
    });
    return true;
  }
  return false;
}

// ---- TOP ISP BACKLOG ----
router.get("/top-backlog", async (_req: Request, res: Response) => {
  if (scaffoldGuard(_req, res)) return;

  if (isDetectBridge()) {
    try {
      const rows = await query(
        `SELECT isp_name, COUNT(*) as backlog
         FROM nip
         WHERE status_open = 'Y' AND isp_name IS NOT NULL AND isp_name != ''
         GROUP BY isp_name
         ORDER BY backlog DESC
         LIMIT 10`
      );
      const items = (rows as any[]).map((r: any) => ({
        isp: r.isp_name, backlog: Number(r.backlog || 0),
      }));
      const total = items.reduce((s, i) => s + i.backlog, 0);
      return res.json({ ok: true, domain: "webd", metric: "isp_top_backlog", source: "detect_bridge", total, items });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  res.status(501).json({ ok: false, domain: "webd", metric: "isp_top_backlog", status: "not_supported", message: "ISP backlog query not yet implemented against db_aces" });
});

// ---- ISP REDUCTION RATE ----
router.get("/reduction-rate", async (_req: Request, res: Response) => {
  if (scaffoldGuard(_req, res)) return;

  if (isDetectBridge()) {
    try {
      const rows = await query(
        `SELECT isp_name,
                COUNT(*) as total,
                SUM(CASE WHEN status_open = 'N' THEN 1 ELSE 0 END) as blocked,
                SUM(CASE WHEN status_open = 'Y' THEN 1 ELSE 0 END) as open_urls
         FROM nip
         WHERE isp_name IS NOT NULL AND isp_name != ''
         GROUP BY isp_name
         ORDER BY total DESC`
      );
      const items = (rows as any[]).map((r: any) => {
        const total = Number(r.total || 0);
        const blocked = Number(r.blocked || 0);
        return {
          isp: r.isp_name,
          total,
          blocked,
          open: Number(r.open_urls || 0),
          reductionPct: total > 0 ? Math.round((blocked / total) * 10000) / 100 : 0,
        };
      });
      return res.json({ ok: true, domain: "webd", metric: "isp_reduction_rate", source: "detect_bridge", items });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  res.status(501).json({ ok: false, domain: "webd", metric: "isp_reduction_rate", status: "not_supported", message: "ISP reduction rate query not yet implemented against db_aces" });
});

export default router;
