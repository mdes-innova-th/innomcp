/**
 * Machines domain routes — scanner/worker machine status
 * Table: machines (285 rows)
 * Key columns: id, pc_name, is_online, isp_name, ip_address, last_check_in
 */
import { Router, Request, Response } from "express";
import { query } from "../db";

const router = Router();

// ---- ACTIVE (ONLINE) COUNT ----
router.get("/active", async (_req: Request, res: Response) => {
  const rows = await query("SELECT COUNT(*) as c FROM machines WHERE is_online = 1");
  res.json({ ok: true, domain: "detect", metric: "machines_active", count: Number((rows as any[])[0]?.c || 0) });
});

// ---- OFFLINE COUNT ----
router.get("/offline", async (_req: Request, res: Response) => {
  const rows = await query("SELECT COUNT(*) as c FROM machines WHERE is_online = 0");
  res.json({ ok: true, domain: "detect", metric: "machines_offline", count: Number((rows as any[])[0]?.c || 0) });
});

// ---- STATUS SUMMARY ----
router.get("/status", async (_req: Request, res: Response) => {
  const [online] = await query("SELECT COUNT(*) as c FROM machines WHERE is_online = 1") as any[];
  const [offline] = await query("SELECT COUNT(*) as c FROM machines WHERE is_online = 0") as any[];
  const [total] = await query("SELECT COUNT(*) as c FROM machines") as any[];
  res.json({
    ok: true, domain: "detect", metric: "machines_status",
    online: Number(online?.c || 0), offline: Number(offline?.c || 0), total: Number(total?.c || 0),
  });
});

// ---- LATEST MACHINES ----
router.get("/latest", async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(1, Number(req.query.limit) || 5), 20);
  const rows = await query(
    "SELECT id, pc_name, isp_name, ip_address, is_online, last_check_in FROM machines ORDER BY last_check_in DESC LIMIT ?",
    [limit]
  );
  const items = (rows as any[]).map((r: any) => ({
    id: r.id, pc_name: r.pc_name, isp_name: r.isp_name, ip_address: r.ip_address,
    is_online: Boolean(r.is_online),
    last_check_in: r.last_check_in ? new Date(r.last_check_in).toISOString() : null,
  }));
  res.json({ ok: true, domain: "detect", metric: "machines_latest", count: items.length, items });
});

export default router;
