/**
 * Record/evidence domain routes — video-recording evidence entries
 * Table: record (1.98M+ rows)
 * Key columns: rec_id, nip_no, create_date, caselist_id, case_sv
 */
import { Router, Request, Response } from "express";
import { query } from "../db";

const router = Router();

function bkkDate(offsetDays = 0): string {
  const d = new Date(Date.now() + 7 * 3600_000 + offsetDays * 86400_000);
  return d.toISOString().slice(0, 10);
}

// ---- RECORDS TODAY ----
router.get("/count/today", async (_req: Request, res: Response) => {
  const today = bkkDate(0);
  const rows = await query("SELECT COUNT(*) as c FROM record WHERE DATE(create_date) = ?", [today]);
  res.json({ ok: true, domain: "detect", metric: "evidence_records_today", date: today, count: Number((rows as any[])[0]?.c || 0) });
});

// ---- RECORDS YESTERDAY ----
router.get("/count/yesterday", async (_req: Request, res: Response) => {
  const yesterday = bkkDate(-1);
  const rows = await query("SELECT COUNT(*) as c FROM record WHERE DATE(create_date) = ?", [yesterday]);
  res.json({ ok: true, domain: "detect", metric: "evidence_records_yesterday", date: yesterday, count: Number((rows as any[])[0]?.c || 0) });
});

// ---- RECORDS YESTERDAY BY ISP TOP ----
router.get("/count/yesterday/by-isp", async (_req: Request, res: Response) => {
  const yesterday = bkkDate(-1);
  const rows = await query(
    "SELECT n.isp_name as isp, COUNT(*) as c FROM record r JOIN nip n ON r.nip_no = n.no WHERE DATE(r.create_date) = ? GROUP BY n.isp_name ORDER BY c DESC LIMIT 10",
    [yesterday]
  );
  const byIsp = (rows as any[]).map((r: any) => ({ isp: r.isp || "ไม่ระบุ", count: Number(r.c) }));
  const total = byIsp.reduce((s, r) => s + r.count, 0);
  res.json({ ok: true, domain: "detect", metric: "evidence_records_yesterday_by_isp", date: yesterday, total, byIsp });
});

// ---- 7-DAY TREND ----
router.get("/trend/7days", async (_req: Request, res: Response) => {
  const end = bkkDate(0);
  const start = bkkDate(-6);
  const rows = await query(
    "SELECT DATE_FORMAT(create_date, '%Y-%m-%d') as d, COUNT(*) as c FROM record WHERE DATE(create_date) BETWEEN ? AND ? GROUP BY d ORDER BY d ASC",
    [start, end]
  );
  const points = (rows as any[]).map((r: any) => ({ date: r.d, count: Number(r.c) }));
  const total = points.reduce((s, p) => s + p.count, 0);
  res.json({ ok: true, domain: "detect", metric: "evidence_records_7day_trend", start, end, total, points });
});

// ---- RECORDS BY NIP NO ----
router.get("/by-nip/:nipNo", async (req: Request, res: Response) => {
  const nipNo = Number(req.params.nipNo);
  if (!Number.isFinite(nipNo)) return res.status(400).json({ ok: false, error: "Invalid nip_no" });
  const rows = await query("SELECT rec_id, nip_no, create_date, caselist_id, case_sv FROM record WHERE nip_no = ? ORDER BY create_date DESC LIMIT 20", [nipNo]);
  const items = (rows as any[]).map((r: any) => ({
    rec_id: r.rec_id, nip_no: r.nip_no,
    create_date: r.create_date ? new Date(r.create_date).toISOString() : null,
    caselist_id: r.caselist_id, case_sv: r.case_sv,
  }));
  res.json({ ok: true, domain: "detect", metric: "records_by_nip", nipNo, count: items.length, items });
});

// ---- URL HAS EVIDENCE ----
router.get("/has-evidence", async (req: Request, res: Response) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).json({ ok: false, error: "url parameter required" });
  // Join nip→record to check if any evidence video exists for this URL
  const rows = await query(
    "SELECT COUNT(*) as c FROM record r JOIN nip n ON r.nip_no = n.no WHERE n.url = ?",
    [url]
  );
  const count = Number((rows as any[])[0]?.c || 0);
  res.json({ ok: true, domain: "detect", metric: "url_has_evidence", url, hasEvidence: count > 0, evidenceCount: count });
});

// ---- TOP NIP BY RECORD COUNT ----
router.get("/top-nip-by-record", async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(1, Number(req.query.limit) || 10), 20);
  const rows = await query("SELECT nip_no, COUNT(*) as c FROM record GROUP BY nip_no ORDER BY c DESC LIMIT ?", [limit]);
  const items = (rows as any[]).map((r: any) => ({ nip_no: Number(r.nip_no || 0), count: Number(r.c || 0) }));
  const total = items.reduce((s, r) => s + r.count, 0);
  res.json({ ok: true, domain: "detect", metric: "top_nip_by_record", total, items });
});

// ---- PENDING EVIDENCE (NIP created today with no record) ----
router.get("/pending", async (_req: Request, res: Response) => {
  const today = bkkDate(0);
  const rows = await query(
    "SELECT COUNT(*) as c FROM nip WHERE DATE(create_date) = ? AND (status_rec IS NULL OR no NOT IN (SELECT nip_no FROM record))",
    [today]
  );
  res.json({ ok: true, domain: "detect", metric: "pending_evidence", date: today, count: Number((rows as any[])[0]?.c || 0) });
});

// ---- OFFICER SUMMARY ----
router.get("/officer-summary", async (_req: Request, res: Response) => {
  const today = bkkDate(0);
  const [onlineR] = await query("SELECT COUNT(*) as c FROM machines WHERE is_online = 1") as any[];
  const [offlineR] = await query("SELECT COUNT(*) as c FROM machines WHERE is_online = 0") as any[];
  const [recordsR] = await query("SELECT COUNT(*) as c FROM record WHERE DATE(create_date) = ?", [today]) as any[];
  const [nipR] = await query("SELECT COUNT(*) as c FROM nip WHERE DATE(create_date) = ?", [today]) as any[];
  res.json({
    ok: true, domain: "detect", metric: "officer_summary", date: today,
    machines: { online: Number(onlineR?.c || 0), offline: Number(offlineR?.c || 0) },
    records: { today: Number(recordsR?.c || 0) },
    nip: { today: Number(nipR?.c || 0) },
  });
});

export default router;
