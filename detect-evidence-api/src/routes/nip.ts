/**
 * NIP domain routes — illegal URL scan outcomes
 * Table: nip (640K+ rows)
 * Key columns: no, url, isp_name, create_date, court_order, status_open, caselist_id
 */
import { Router, Request, Response } from "express";
import { query } from "../db";

const router = Router();

/** Helper: Bangkok-local date string (YYYY-MM-DD) */
function bkkDate(offsetDays = 0): string {
  const d = new Date(Date.now() + 7 * 3600_000 + offsetDays * 86400_000);
  return d.toISOString().slice(0, 10);
}

/** Helper: get Monday of current week */
function bkkMonday(): string {
  const d = new Date(Date.now() + 7 * 3600_000);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Helper: normalize user-supplied ISP token to the canonical lowercase value
 * stored in `nip.isp_name`. Returns null if the token does not map to a known ISP.
 *
 * Canonical values observed in detect.nip: true, ais, tot, 3bb, nt, dtac.
 *
 * The previous implementation wrapped the input in `%...%` for LIKE, which caused
 * substring contamination — e.g. ?isp=ot returned all "tot" rows; ?isp=t returned
 * counts from true/tot/nt/dtac. Filtering must be exact.
 */
const ISP_CANONICAL: Record<string, string> = {
  ais: "ais", เอไอเอส: "ais",
  dtac: "dtac", ดีแทค: "dtac",
  true: "true", ทรู: "true", trueonline: "true", truemove: "true",
  tot: "tot", ทีโอที: "tot",
  nt: "nt", cat: "nt", "tot/nt": "nt",
  "3bb": "3bb",
};

function canonicalIsp(isp: string): string | null {
  const key = String(isp || "").trim().toLowerCase();
  if (!key) return null;
  return ISP_CANONICAL[key] || null;
}

// ---- ISP MONTH COUNT ----
// GET /nip/stats/isp/month?isp=AIS&month=2026-04
router.get("/stats/isp/month", async (req: Request, res: Response) => {
  const isp = req.query.isp as string | undefined;
  const month = req.query.month as string || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; })();
  const [yr, mo] = month.split("-").map(Number);

  let sql = "SELECT isp_name, COUNT(*) as c FROM nip WHERE YEAR(create_date)=? AND MONTH(create_date)=?";
  const params: any[] = [yr, mo];
  if (isp) {
    const canon = canonicalIsp(isp);
    if (!canon) {
      return res.json({ ok: true, domain: "detect", metric: "nip_count_by_isp", month, ispFilter: isp, total: 0, byIsp: [], note: "ISP filter not recognized — known: ais, dtac, true, tot, nt, 3bb" });
    }
    sql += " AND isp_name = ?";
    params.push(canon);
  }
  sql += " GROUP BY isp_name ORDER BY c DESC LIMIT 20";

  const rows = await query(sql, params);
  const byIsp = (rows as any[]).map((r: any) => ({ isp: r.isp_name || "ไม่ระบุ", count: Number(r.c) }));
  const total = byIsp.reduce((s, r) => s + r.count, 0);
  res.json({ ok: true, domain: "detect", metric: "nip_count_by_isp", month, ispFilter: isp || null, total, byIsp });
});

// ---- ISP TODAY COUNT ----
// GET /nip/stats/isp/today?isp=AIS
router.get("/stats/isp/today", async (req: Request, res: Response) => {
  const isp = req.query.isp as string | undefined;
  const today = bkkDate(0);
  let sql = "SELECT COUNT(*) as c FROM nip WHERE DATE(create_date) = ?";
  const params: any[] = [today];
  if (isp) {
    const canon = canonicalIsp(isp);
    if (!canon) {
      return res.json({ ok: true, domain: "detect", metric: "nip_count_today", date: today, ispFilter: isp, count: 0, note: "ISP filter not recognized — known: ais, dtac, true, tot, nt, 3bb" });
    }
    sql += " AND isp_name = ?"; params.push(canon);
  }
  const rows = await query(sql, params);
  res.json({ ok: true, domain: "detect", metric: "nip_count_today", date: today, ispFilter: isp || null, count: Number((rows as any[])[0]?.c || 0) });
});

// ---- ISP WEEK COUNT ----
// GET /nip/stats/isp/week?isp=DTAC
router.get("/stats/isp/week", async (req: Request, res: Response) => {
  const isp = req.query.isp as string | undefined;
  const weekStart = bkkMonday();
  const weekEnd = bkkDate(0);
  let sql = "SELECT COUNT(*) as c FROM nip WHERE DATE(create_date) BETWEEN ? AND ?";
  const params: any[] = [weekStart, weekEnd];
  if (isp) {
    const canon = canonicalIsp(isp);
    if (!canon) {
      return res.json({ ok: true, domain: "detect", metric: "nip_count_week", weekStart, weekEnd, ispFilter: isp, count: 0, note: "ISP filter not recognized — known: ais, dtac, true, tot, nt, 3bb" });
    }
    sql += " AND isp_name = ?"; params.push(canon);
  }
  const rows = await query(sql, params);
  res.json({ ok: true, domain: "detect", metric: "nip_count_week", weekStart, weekEnd, ispFilter: isp || null, count: Number((rows as any[])[0]?.c || 0) });
});

// ---- DELTA TODAY VS YESTERDAY ----
// GET /nip/stats/isp/delta/today-vs-yesterday?isp=AIS
router.get("/stats/isp/delta/today-vs-yesterday", async (req: Request, res: Response) => {
  const isp = req.query.isp as string | undefined;
  const today = bkkDate(0);
  const yesterday = bkkDate(-1);
  let sqlT = "SELECT COUNT(*) as c FROM nip WHERE DATE(create_date) = ?";
  let sqlY = "SELECT COUNT(*) as c FROM nip WHERE DATE(create_date) = ?";
  const paramsT: any[] = [today];
  const paramsY: any[] = [yesterday];
  if (isp) {
    const canon = canonicalIsp(isp);
    if (!canon) {
      return res.json({ ok: true, domain: "detect", metric: "nip_delta_today_vs_yesterday", ispFilter: isp, todayCount: 0, yesterdayCount: 0, delta: 0, direction: "equal", note: "ISP filter not recognized — known: ais, dtac, true, tot, nt, 3bb" });
    }
    sqlT += " AND isp_name = ?"; paramsT.push(canon);
    sqlY += " AND isp_name = ?"; paramsY.push(canon);
  }
  const [rT, rY] = await Promise.all([query(sqlT, paramsT), query(sqlY, paramsY)]);
  const todayCount = Number((rT as any[])[0]?.c || 0);
  const yesterdayCount = Number((rY as any[])[0]?.c || 0);
  const delta = todayCount - yesterdayCount;
  res.json({ ok: true, domain: "detect", metric: "nip_delta_today_vs_yesterday", ispFilter: isp || null, todayCount, yesterdayCount, delta, direction: delta > 0 ? "increase" : delta < 0 ? "decrease" : "equal" });
});

// ---- TOP ISP ALL TIME ----
// GET /nip/stats/top-isp/all-time?limit=10
router.get("/stats/top-isp/all-time", async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(1, Number(req.query.limit) || 10), 20);
  const rows = await query("SELECT isp_name, COUNT(*) as c FROM nip GROUP BY isp_name ORDER BY c DESC LIMIT ?", [limit]);
  const byIsp = (rows as any[]).map((r: any) => ({ isp: r.isp_name || "ไม่ระบุ", count: Number(r.c) }));
  const total = byIsp.reduce((s, r) => s + r.count, 0);
  res.json({ ok: true, domain: "detect", metric: "nip_top_isp_all_time", total, byIsp });
});

// ---- TOP ISP THIS MONTH ----
// GET /nip/stats/top-isp/month?month=2026-04&limit=10
router.get("/stats/top-isp/month", async (req: Request, res: Response) => {
  const month = req.query.month as string || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; })();
  const [yr, mo] = month.split("-").map(Number);
  const limit = Math.min(Math.max(1, Number(req.query.limit) || 10), 20);
  const rows = await query("SELECT isp_name, COUNT(*) as c FROM nip WHERE YEAR(create_date)=? AND MONTH(create_date)=? GROUP BY isp_name ORDER BY c DESC LIMIT ?", [yr, mo, limit]);
  const byIsp = (rows as any[]).map((r: any) => ({ isp: r.isp_name || "ไม่ระบุ", count: Number(r.c) }));
  const total = byIsp.reduce((s, r) => s + r.count, 0);
  res.json({ ok: true, domain: "detect", metric: "nip_top_isp_month", month, total, byIsp });
});

// ---- DISTINCT URL COUNT ----
// GET /nip/distinct/month?isp=NT,TRUE&month=2026-04
router.get("/distinct/month", async (req: Request, res: Response) => {
  const ispParam = req.query.isp as string | undefined;
  const month = req.query.month as string || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; })();
  const [yr, mo] = month.split("-").map(Number);
  let sql = "SELECT isp_name as isp, COUNT(DISTINCT url) as c FROM nip WHERE YEAR(create_date)=? AND MONTH(create_date)=?";
  const params: any[] = [yr, mo];
  if (ispParam) {
    const requested = ispParam.split(",").map(s => s.trim()).filter(Boolean);
    const canons = Array.from(new Set(requested.map(canonicalIsp).filter((v): v is string => v !== null)));
    if (canons.length === 0) {
      return res.json({ ok: true, domain: "detect", metric: "nip_distinct_url_month", month, ispFilter: ispParam, total: 0, byIsp: [], note: "No ISP filter recognized — known: ais, dtac, true, tot, nt, 3bb" });
    }
    if (canons.length === 1) { sql += " AND isp_name = ?"; params.push(canons[0]); }
    else {
      const orClauses = canons.map(() => "isp_name = ?").join(" OR ");
      sql += ` AND (${orClauses})`;
      params.push(...canons);
    }
  }
  sql += " GROUP BY isp_name ORDER BY c DESC";
  const rows = await query(sql, params);
  const byIsp = (rows as any[]).map((r: any) => ({ isp: r.isp || "ไม่ระบุ", count: Number(r.c) }));
  const total = byIsp.reduce((s, r) => s + r.count, 0);
  res.json({ ok: true, domain: "detect", metric: "nip_distinct_url_month", month, ispFilter: ispParam || null, total, byIsp });
});

// ---- LATEST URLS ----
// GET /nip/latest?isp=DTAC&month=2026-04&limit=20
router.get("/latest", async (req: Request, res: Response) => {
  const isp = req.query.isp as string | undefined;
  const month = req.query.month as string | undefined;
  const limit = Math.min(Math.max(1, Number(req.query.limit) || 20), 50);
  let sql = "SELECT no, url, isp_name, create_date, court_order, status_open FROM nip WHERE 1=1";
  const params: any[] = [];
  if (month) {
    const [yr, mo] = month.split("-").map(Number);
    sql += " AND YEAR(create_date)=? AND MONTH(create_date)=?";
    params.push(yr, mo);
  }
  if (isp) {
    const canon = canonicalIsp(isp);
    if (!canon) {
      return res.json({ ok: true, domain: "detect", metric: "nip_latest", ispFilter: isp, count: 0, items: [], note: "ISP filter not recognized — known: ais, dtac, true, tot, nt, 3bb" });
    }
    sql += " AND isp_name = ?"; params.push(canon);
  }
  sql += " ORDER BY create_date DESC LIMIT ?";
  params.push(limit);
  const rows = await query(sql, params);
  const items = (rows as any[]).map((r: any) => ({
    no: r.no, url: r.url, isp_name: r.isp_name,
    create_date: r.create_date ? new Date(r.create_date).toISOString() : null,
    court_order: r.court_order || null, status_open: r.status_open || null,
  }));
  res.json({ ok: true, domain: "detect", metric: "nip_latest", ispFilter: isp || null, month: month || null, requestedLimit: limit, count: items.length, items });
});

// ---- URL LOOKUP ----
// GET /nip/by-url?url=example.com
router.get("/by-url", async (req: Request, res: Response) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).json({ ok: false, error: "url parameter required" });
  const rows = await query("SELECT no, url, isp_name, create_date, court_order, status_open, status_rec FROM nip WHERE url = ? ORDER BY create_date DESC LIMIT 5", [url]);
  const items = (rows as any[]).map((r: any) => ({
    no: r.no, url: r.url, isp_name: r.isp_name,
    create_date: r.create_date ? new Date(r.create_date).toISOString() : null,
    court_order: r.court_order || null, status_open: r.status_open, status_rec: r.status_rec,
  }));
  const hasCourtOrder = items.some(i => i.court_order && i.court_order.trim() !== "");
  const hasEvidence = items.some(i => i.status_rec === "1" || i.status_rec === "Y");
  res.json({ ok: true, domain: "detect", metric: "nip_by_url", url, count: items.length, hasCourtOrder, hasEvidence, items });
});

// ---- RECENT THREATS (NIP CREATED TODAY) ----
router.get("/recent-threats", async (_req: Request, res: Response) => {
  const today = bkkDate(0);
  const rows = await query("SELECT COUNT(*) as c FROM nip WHERE DATE(create_date) = ?", [today]);
  res.json({ ok: true, domain: "detect", metric: "recent_threats", date: today, count: Number((rows as any[])[0]?.c || 0) });
});

export default router;
