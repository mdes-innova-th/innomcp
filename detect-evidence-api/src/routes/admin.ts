/**
 * Admin/contract-map routes — exposes the domain contract map
 */
import { Router, Request, Response } from "express";
import { query } from "../db";

const router = Router();

const CONTRACT_MAP = {
  domain: "detect-evidence",
  version: "1.0.0",
  description: "Detect/Evidence domain — scan outcomes, illegal URL tracking, video-recording evidence, scanner machines",
  tables: {
    nip: {
      meaning: "URLs found still publicly accessible by urlchecker scans",
      rowCount: "~640K",
      keyColumns: ["no", "url", "isp_name", "create_date", "court_order", "status_open", "status_rec", "caselist_id"],
    },
    record: {
      meaning: "Video-recording evidence entries proving URL was still accessible",
      rowCount: "~1.98M",
      keyColumns: ["rec_id", "nip_no", "create_date", "caselist_id", "case_sv"],
    },
    machines: {
      meaning: "Scanner/worker machines running urlchecker automation",
      rowCount: "~285",
      keyColumns: ["id", "pc_name", "is_online", "isp_name", "ip_address", "last_check_in"],
    },
  },
  metrics: [
    { id: "nip_count_by_isp", meaning: "URL count by ISP for a given period", supports: ["month", "today", "week"], filterable: true },
    { id: "nip_distinct_url_month", meaning: "Distinct URL count (not duplicate scans) by ISP for a month", supports: ["month"], filterable: true },
    { id: "nip_latest", meaning: "Latest N URLs found, optionally filtered by ISP and month", supports: ["month", "all"], filterable: true },
    { id: "nip_top_isp_all_time", meaning: "Top ISPs by total URL count across all time", supports: ["all"], filterable: false },
    { id: "nip_top_isp_month", meaning: "Top ISPs by URL count for a specific month", supports: ["month"], filterable: false },
    { id: "nip_delta_today_vs_yesterday", meaning: "URL count comparison: today vs yesterday", supports: ["today", "yesterday"], filterable: true },
    { id: "nip_by_url", meaning: "Lookup specific URL — has court order? has evidence?", supports: ["all"], filterable: false },
    { id: "evidence_records_today", meaning: "Video evidence records created today", supports: ["today"], filterable: false },
    { id: "evidence_records_yesterday", meaning: "Video evidence records created yesterday", supports: ["yesterday"], filterable: false },
    { id: "evidence_records_yesterday_by_isp", meaning: "Video evidence records by ISP from yesterday", supports: ["yesterday"], filterable: false },
    { id: "evidence_records_7day_trend", meaning: "7-day trend of video evidence records", supports: ["7days"], filterable: false },
    { id: "records_by_nip", meaning: "Evidence records for a specific NIP number", supports: ["all"], filterable: false },
    { id: "url_has_evidence", meaning: "Does this URL have video evidence recorded?", supports: ["all"], filterable: false },
    { id: "machines_active", meaning: "Count of online scanner machines", supports: ["now"], filterable: false },
    { id: "machines_offline", meaning: "Count of offline scanner machines", supports: ["now"], filterable: false },
    { id: "machines_status", meaning: "Full machine status summary (online/offline/total)", supports: ["now"], filterable: false },
    { id: "machines_latest", meaning: "Latest N machines by last check-in time", supports: ["now"], filterable: false },
  ],
  unsupported: [
    { id: "isp_reduction_rate", reason: "Requires historical monthly snapshots that do not exist in current schema. Cannot compute month-over-month reduction rate without archived monthly totals." },
    { id: "webd_court_order_url_count", reason: "Web-D domain tables (case_order, courtorder, case_data) do not exist in the detect database. Separate web-d data source required." },
    { id: "webd_url_has_court_order", reason: "nip.court_order column exists but contains raw order reference strings — not linked to a court_order table (which doesn't exist in detect DB)." },
  ],
};

router.get("/contract-map", (_req: Request, res: Response) => {
  res.json(CONTRACT_MAP);
});

// ---- SCHEMA DISCOVERY ----
const ALLOWED_TABLES = ["machines", "nip", "record", "entries", "sip"];

router.get("/tables", async (_req: Request, res: Response) => {
  const rows = await query("SHOW TABLES");
  const names = (rows as any[]).map((r: any) => String(Object.values(r)[0] || "")).filter(Boolean);
  res.json({ ok: true, domain: "detect", tables: names });
});

router.get("/describe/:table", async (req: Request, res: Response) => {
  const table = String(req.params.table || "");
  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ ok: false, error: `Table '${table}' not in whitelist` });
  }
  const rows = await query(`SHOW COLUMNS FROM \`${table}\``);
  const columns = (rows as any[]).map((r: any) => String(r.Field || r.field || "")).filter(Boolean);
  res.json({ ok: true, domain: "detect", table, columns });
});

export default router;
