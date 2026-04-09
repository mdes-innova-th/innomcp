/**
 * URL routes — Web-D domain (db_aces)
 *
 * Live mode: real SQL against db_aces tables
 * Scaffold mode: 503 with honest explanation
 */
import { Router, Request, Response } from "express";
import { query, getMode } from "../db";

const router = Router();

function scaffoldGuard(_req: Request, res: Response): boolean {
  if (getMode() === "scaffold") {
    res.status(503).json({
      ok: false, domain: "webd", status: "scaffold",
      message: "Web-D URL database (db_aces) not yet connected. Set WEBD_DB_HOST/USER/PASSWORD env vars.",
    });
    return true;
  }
  return false;
}

// ---- CHECK IF URL HAS A COURT ORDER ----
router.get("/has-court-order", async (req: Request, res: Response) => {
  if (scaffoldGuard(req, res)) return;
  const url = String(req.query.url || "").trim();
  if (!url) return res.status(400).json({ ok: false, error: "Missing url query param" });
  try {
    const rows = await query(
      `SELECT cl.id, cl.case_id, co.order_no
       FROM case_listdata cl
       JOIN case_order co ON co.id = cl.case_id
       WHERE cl.url = ?
       LIMIT 5`,
      [url]
    );
    const matches = (rows as any[]).map((r: any) => ({
      listId: r.id, orderId: r.case_id, orderNo: r.order_no,
    }));
    res.json({ ok: true, domain: "webd", metric: "url_has_court_order", url, found: matches.length > 0, matches });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---- URLs BY CASE LIST (paginated) ----
router.get("/by-caselist/:caseId", async (req: Request, res: Response) => {
  if (scaffoldGuard(req, res)) return;
  const caseId = Number(req.params.caseId);
  if (!Number.isFinite(caseId)) return res.status(400).json({ ok: false, error: "Invalid caseId" });
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(Math.max(1, Number(req.query.pageSize) || 50), 200);
  const offset = (page - 1) * pageSize;
  try {
    const countRows = await query("SELECT COUNT(*) as c FROM case_listdata WHERE case_id = ?", [caseId]);
    const total = Number((countRows as any[])[0]?.c || 0);
    const rows = await query(
      "SELECT id, url, status FROM case_listdata WHERE case_id = ? LIMIT ? OFFSET ?",
      [caseId, pageSize, offset]
    );
    const items = (rows as any[]).map((r: any) => ({ id: r.id, url: r.url, status: r.status }));
    res.json({ ok: true, domain: "webd", metric: "urls_by_caselist", caseId, total, page, pageSize, items });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---- URL HAS EVIDENCE ----
router.get("/has-evidence", async (req: Request, res: Response) => {
  if (scaffoldGuard(req, res)) return;
  const url = String(req.query.url || "").trim();
  if (!url) return res.status(400).json({ ok: false, error: "Missing url query param" });
  try {
    const rows = await query(
      `SELECT cl.id, cl.case_id, cl.status
       FROM case_listdata cl
       JOIN case_listdata_check clc ON clc.case_listdata_id = cl.id
       WHERE cl.url = ?
       LIMIT 5`,
      [url]
    );
    const found = (rows as any[]).length > 0;
    res.json({ ok: true, domain: "webd", metric: "url_has_evidence", url, found, count: (rows as any[]).length });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
