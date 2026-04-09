/**
 * Court Orders routes — Web-D domain (db_aces)
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
      message: "Web-D court-order database (db_aces) not yet connected. Set WEBD_DB_HOST/USER/PASSWORD env vars.",
    });
    return true;
  }
  return false;
}

// ---- URL COUNT BY COURT ORDER ID ----
router.get("/:orderId/url-count", async (req: Request, res: Response) => {
  if (scaffoldGuard(req, res)) return;
  const orderId = Number(req.params.orderId);
  if (!Number.isFinite(orderId)) return res.status(400).json({ ok: false, error: "Invalid orderId" });
  try {
    const rows = await query(
      "SELECT COUNT(*) as c FROM case_listdata WHERE case_id = ?",
      [orderId]
    );
    const count = Number((rows as any[])[0]?.c || 0);
    res.json({ ok: true, domain: "webd", metric: "court_order_url_count", orderId, count });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---- URL COUNT BY ORDER NUMBER ----
router.get("/by-order-no/:orderNo/url-count", async (req: Request, res: Response) => {
  if (scaffoldGuard(req, res)) return;
  const orderNo = req.params.orderNo;
  try {
    const orderRows = await query(
      "SELECT id FROM case_order WHERE order_no = ? LIMIT 1",
      [orderNo]
    );
    if (!(orderRows as any[]).length) return res.json({ ok: true, domain: "webd", metric: "court_order_url_count_by_no", orderNo, count: 0, note: "Order not found" });
    const orderId = (orderRows as any[])[0].id;
    const rows = await query("SELECT COUNT(*) as c FROM case_listdata WHERE case_id = ?", [orderId]);
    const count = Number((rows as any[])[0]?.c || 0);
    res.json({ ok: true, domain: "webd", metric: "court_order_url_count_by_no", orderNo, orderId, count });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---- TOP COURT ORDERS BY URL COUNT ----
router.get("/top-by-url-count", async (req: Request, res: Response) => {
  if (scaffoldGuard(req, res)) return;
  const limit = Math.min(Math.max(1, Number(req.query.limit) || 10), 20);
  try {
    const rows = await query(
      `SELECT co.id, co.order_no, COUNT(cl.id) as url_count
       FROM case_order co
       LEFT JOIN case_listdata cl ON cl.case_id = co.id
       GROUP BY co.id, co.order_no
       ORDER BY url_count DESC
       LIMIT ?`,
      [limit]
    );
    const items = (rows as any[]).map((r: any) => ({
      orderId: r.id, orderNo: r.order_no, urlCount: Number(r.url_count || 0),
    }));
    res.json({ ok: true, domain: "webd", metric: "top_court_orders_by_url", items });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
