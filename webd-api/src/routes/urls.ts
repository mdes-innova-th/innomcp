/**
 * URL routes — Web-D domain (db_aces / detect_bridge)
 *
 * Live mode: real SQL against db_aces tables OR detect.nip bridge
 * Scaffold mode: 503 with honest explanation
 */
import { Router, Request, Response } from "express";
import { query, getMode, isDetectBridge } from "../db";

const router = Router();

function scaffoldGuard(_req: Request, res: Response): boolean {
  if (getMode() === "scaffold") {
    res.status(503).json({
      ok: false, domain: "webd", status: "scaffold",
      message: "Web-D URL database not yet connected. Set WEBD_DB_HOST/USER/PASSWORD env vars.",
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
    let matches: any[];
    if (isDetectBridge()) {
      const rows = await query(
        `SELECT no, court_order, case_number, isp_name
         FROM nip
         WHERE url = ?
         LIMIT 5`,
        [url]
      );
      matches = (rows as any[]).map((r: any) => ({
        nipNo: r.no, courtOrder: r.court_order, caseNumber: r.case_number, isp: r.isp_name,
      }));
    } else {
      const rows = await query(
        `SELECT cl.id, cl.case_id, co.order_no
         FROM case_listdata cl
         JOIN case_order co ON co.id = cl.case_id
         WHERE cl.url = ?
         LIMIT 5`,
        [url]
      );
      matches = (rows as any[]).map((r: any) => ({
        listId: r.id, orderId: r.case_id, orderNo: r.order_no,
      }));
    }
    res.json({ ok: true, domain: "webd", metric: "url_has_court_order", url, found: matches.length > 0, matches });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---- URLs BY CASE LIST (paginated) ----
router.get("/by-caselist/:caseId", async (req: Request, res: Response) => {
  if (scaffoldGuard(req, res)) return;
  const caseId = req.params.caseId;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(Math.max(1, Number(req.query.pageSize) || 50), 200);
  const offset = (page - 1) * pageSize;
  try {
    let total: number;
    let items: any[];
    if (isDetectBridge()) {
      // caseId is court_order string in detect_bridge mode
      const countRows = await query("SELECT COUNT(*) as c FROM nip WHERE court_order = ?", [caseId]);
      total = Number((countRows as any[])[0]?.c || 0);
      const rows = await query(
        "SELECT no, url, status_open, isp_name FROM nip WHERE court_order = ? LIMIT ? OFFSET ?",
        [caseId, pageSize, offset]
      );
      items = (rows as any[]).map((r: any) => ({ id: r.no, url: r.url, status: r.status_open, isp: r.isp_name }));
    } else {
      if (!Number.isFinite(Number(caseId))) return res.status(400).json({ ok: false, error: "Invalid caseId" });
      const countRows = await query("SELECT COUNT(*) as c FROM case_listdata WHERE case_id = ?", [Number(caseId)]);
      total = Number((countRows as any[])[0]?.c || 0);
      const rows = await query(
        "SELECT id, url, status FROM case_listdata WHERE case_id = ? LIMIT ? OFFSET ?",
        [Number(caseId), pageSize, offset]
      );
      items = (rows as any[]).map((r: any) => ({ id: r.id, url: r.url, status: r.status }));
    }
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
    let found: boolean;
    let count: number;
    if (isDetectBridge()) {
      const rows = await query(
        `SELECT COUNT(*) as c
         FROM record r
         JOIN nip n ON r.nip_no = n.no
         WHERE n.url = ?`,
        [url]
      );
      count = Number((rows as any[])[0]?.c || 0);
      found = count > 0;
    } else {
      const rows = await query(
        `SELECT cl.id, cl.case_id, cl.status
         FROM case_listdata cl
         JOIN case_listdata_check clc ON clc.case_listdata_id = cl.id
         WHERE cl.url = ?
         LIMIT 5`,
        [url]
      );
      count = (rows as any[]).length;
      found = count > 0;
    }
    res.json({ ok: true, domain: "webd", metric: "url_has_evidence", url, found, count });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
