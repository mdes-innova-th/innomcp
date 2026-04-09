/**
 * Evidence Tool — THIN HTTP ADAPTER (Phase 19)
 *
 * This file contains NO business SQL. All queries are delegated to
 * the detect-evidence-api microservice on port 3013.
 *
 * Architecture: innomcp-node -> HTTP -> detect-evidence-api -> MySQL
 */
import { MCPTool } from "../types";

export const EVIDENCE_TOOL_NAME = "detect_evidence_stats";

const DETECT_API_BASE = `http://${process.env.DETECT_API_HOST || "localhost"}:${process.env.DETECT_API_PORT || "3013"}`;

/** HTTP helper — call detect-evidence-api */
async function callDetectAPI<T = any>(path: string, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${DETECT_API_BASE}${path}`, {
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`DetectAPI ${res.status}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Bangkok helpers */
function bkkMonth(): string {
  const d = new Date(Date.now() + 7 * 3600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getBangkokDate(offsetDays: number): string {
  const d = new Date(Date.now() + 7 * 3600_000 + offsetDays * 86400_000);
  return d.toISOString().slice(0, 10);
}

type EvidenceDataSource = "detect-api" | "placeholder";

const buildKpis = (total: number, topIspName?: string | null, topIspCount?: number | null) => ({
  total: Number.isFinite(total) ? total : 0,
  topIspName: topIspName ?? null,
  topIspCount: typeof topIspCount === "number" && Number.isFinite(topIspCount) ? topIspCount : null,
});

const metaFor = (dataSource: EvidenceDataSource, note?: string) => {
  const meta: any = { dataSource };
  if (dataSource === "placeholder") meta.note = note || "detect-evidence-api not available";
  return meta;
};

const buildMissingCreds = (currentIntent: string) => ({
  ok: false,
  code: "DETECT_API_UNAVAILABLE",
  intent: currentIntent,
  meta: metaFor("placeholder"),
  message: "ขออภัย ขณะนี้ยังไม่พร้อมเชื่อมต่อฐานข้อมูลหลักฐาน กรุณาติดต่อผู้ดูแลระบบหรือลองใหม่ภายหลังครับ",
  kpis: buildKpis(0, null, null),
  table: { rows: [{ isp: "(ยังไม่มีข้อมูล)", count: 0 }] },
});

const buildErrorShell = (currentIntent: string, code: string) => ({
  ok: false,
  code,
  intent: currentIntent,
  meta: metaFor("placeholder"),
  message: "ขออภัย ระบบสืบค้นฐานข้อมูลหลักฐานขัดข้อง กรุณาลองใหม่อีกครั้งครับ",
  kpis: buildKpis(0, null, null),
});

export const EVIDENCE_TOOL_DEF: MCPTool = {
  name: EVIDENCE_TOOL_NAME,
  description:
    "Officer evidence reporting tool (Detect DB via detect-evidence-api). Thin HTTP adapter — no business SQL.",
  category: "evidence",
  keywords: ["evidence", "threat", "nip", "record", "หลักฐาน", "คนร้าย", "สถานะเครื่อง", "cloud", "server"],
  examples: [
    "ขอสถานะเครื่อง server หน่อย",
    "มีหลักฐานอะไรค้างบ้าง",
    "ขอรายการ threat ล่าสุด 10 รายการ"
  ],
  inputSchema: {
    type: "object",
    properties: {
      intent: {
        type: "string",
        enum: [
          "machine_status",
          "active_evidence_machines",
          "active_evidence_machines_offline",
          "machines_evidence_active_today",
          "evidence_records_today",
          "evidence_records_yesterday_total",
          "evidence_records_yesterday_by_isp_top",
          "evidence_records_last_7_days_trend",
          "pending_evidence",
          "recent_threats",
          "detected_urls_today",
          "nip_top_isp_this_month",
          "nip_top_isp_all",
          "machine_last_scan",
          "nip_latest",
          "nip_by_record_top",
          "nip_unique_this_month",
          "detected_urls_this_week",
          "nip_latest_by_isp_month",
          "detected_urls_delta",
        ],
        description: "The specific query intent to execute."
      },
      limit: { type: "number", description: "Optional limit for results (default 10)" },
      ispFilter: { type: "string", description: "Optional ISP name filter (e.g. dtac, ais, true, tot, 3bb, nt)" }
    },
    required: ["intent"]
  }
};

export async function handleEvidenceTool(args: any): Promise<any> {
  const { intent } = args || {};
  const ispFilter = args?.ispFilter ? String(args.ispFilter).trim() : null;
  const limit = Math.min(Math.max(1, Number(args?.limit) || 10), 50);
  const meta = metaFor("detect-api");
  const today = getBangkokDate(0);

  try {
    if (process.env.TEST_DEGRADE_DB === "1") throw Object.assign(new Error("DB_DEGRADED"), { code: "DETECT_API_UNAVAILABLE" });
    if (!intent) return { ok: false, code: "MISSING_INTENT", meta: metaFor("placeholder"), message: "intent is required" };

    // ===== MACHINES =====
    if (intent === "active_evidence_machines" || intent === "machine_status") {
      const data = await callDetectAPI<any>("/machines/active");
      const n = Number(data.count || 0);
      return { ok: true, intent: "active_evidence_machines", meta, count: n, kpis: buildKpis(n, null, null), summary: `ตอนนี้เครื่องออนไลน์: ${n} เครื่อง` };
    }

    if (intent === "active_evidence_machines_offline") {
      const data = await callDetectAPI<any>("/machines/offline");
      const n = Number(data.count || 0);
      return { ok: true, intent, meta, count: n, kpis: buildKpis(n, null, null), summary: `ตอนนี้เครื่องออฟไลน์: ${n} เครื่อง` };
    }

    if (intent === "machines_evidence_active_today") {
      const data = await callDetectAPI<any>("/machines/status");
      const n = Number(data.online || 0);
      return { ok: true, intent, meta, count: n, kpis: buildKpis(n, null, null), summary: `วันนี้ machine evidence ทำงาน: ${n} เครื่อง` };
    }

    if (intent === "machine_last_scan") {
      const data = await callDetectAPI<any>("/machines/latest?limit=5");
      const machines = data.items || [];
      const latest = machines[0] || null;
      return {
        ok: true, intent, machines, latest, meta,
        kpis: buildKpis(machines.length, latest?.isp_name ?? null, null),
        summary: latest ? `เครื่องสแกนล่าสุด: ${latest.pc_name} (${latest.isp_name}) ตรวจสอบล่าสุด ${String(latest.last_check_in || "").slice(0,10)||"-"}` : "ไม่พบข้อมูล",
      };
    }

    // ===== RECORDS / EVIDENCE =====
    if (intent === "evidence_records_today") {
      const data = await callDetectAPI<any>("/records/count/today");
      const n = Number(data.count || 0);
      return { ok: true, intent, meta, count: n, kpis: buildKpis(n, null, null), summary: `วันนี้จัดเก็บหลักฐานวิดีโอได้: ${n} รายการ` };
    }

    if (intent === "evidence_records_yesterday_total") {
      const data = await callDetectAPI<any>("/records/count/yesterday");
      const n = Number(data.count || 0);
      return { ok: true, intent, meta, date: data.date, count: n, kpis: buildKpis(n, null, null), summary: `เมื่อวานนี้จัดเก็บหลักฐานวิดีโอได้: ${n} รายการ` };
    }

    if (intent === "evidence_records_yesterday_by_isp_top") {
      const data = await callDetectAPI<any>("/records/count/yesterday/by-isp");
      const byIsp = data.byIsp || [];
      const total = Number(data.total || 0);
      const top = byIsp[0] || null;
      const tableRows = byIsp.slice(0, 3);
      while (tableRows.length < 3) tableRows.push({ isp: "(ยังไม่มีข้อมูล)", count: 0 });
      const sumTop = tableRows.reduce((s: number, r: any) => s + Number(r.count || 0), 0);
      tableRows.push({ isp: "อื่นๆ", count: Math.max(0, total - sumTop) });
      return {
        ok: true, intent, meta, date: data.date, total, byIsp: tableRows, topIsp: top,
        kpis: buildKpis(total, top?.isp ?? null, top?.count ?? null),
        table: { rows: tableRows },
        summary: top ? `เมื่อวานนี้รวม ${total} รายการ | ISP มากสุด: ${top.isp} (${top.count})` : `เมื่อวานนี้รวม ${total} รายการ`,
      };
    }

    if (intent === "evidence_records_last_7_days_trend") {
      const data = await callDetectAPI<any>("/records/trend/7days");
      const points = data.points || [];
      const total = Number(data.total || 0);
      return {
        ok: true, intent, meta, range: { start: data.start, end: data.end },
        kpis: buildKpis(total, null, null),
        series: { label: "หลักฐานต่อวัน", points },
        summary: `แนวโน้ม 7 วันล่าสุด: รวม ${total} รายการ`,
      };
    }

    if (intent === "pending_evidence") {
      const data = await callDetectAPI<any>("/records/pending");
      const n = Number(data.count || 0);
      return { ok: true, intent, meta, count: n, kpis: buildKpis(n, null, null), summary: `หลักฐานค้างดำเนินการวันนี้: ${n} รายการ` };
    }

    if (intent === "recent_threats") {
      const data = await callDetectAPI<any>("/nip/recent-threats");
      const n = Number(data.count || 0);
      return { ok: true, intent, meta, count: n, kpis: buildKpis(n, null, null), summary: `เหตุการณ์ (NIP) วันนี้: ${n} รายการ` };
    }

    // ===== NIP =====
    if (intent === "detected_urls_today") {
      const qs = ispFilter ? `?isp=${encodeURIComponent(ispFilter)}` : "";
      const data = await callDetectAPI<any>(`/nip/stats/isp/today${qs}`);
      const n = Number(data.count || 0);
      const label = ispFilter ? `วันนี้ตรวจพบ URL/NIP จาก ${ispFilter.toUpperCase()}: ${n} รายการ` : `วันนี้ตรวจพบ URL/NIP: ${n} รายการ`;
      return { ok: true, intent, ispFilter: ispFilter || undefined, meta, count: n, kpis: buildKpis(n, null, null), summary: label };
    }

    if (intent === "detected_urls_this_week") {
      const qs = ispFilter ? `?isp=${encodeURIComponent(ispFilter)}` : "";
      const data = await callDetectAPI<any>(`/nip/stats/isp/week${qs}`);
      const n = Number(data.count || 0);
      const label = ispFilter
        ? `สัปดาห์นี้ (${data.weekStart} ถึง ${data.weekEnd}) ตรวจพบ URL/NIP จาก ${ispFilter.toUpperCase()}: ${n} รายการ`
        : `สัปดาห์นี้ (${data.weekStart} ถึง ${data.weekEnd}) ตรวจพบ URL/NIP: ${n} รายการ`;
      return { ok: true, intent, ispFilter: ispFilter || undefined, weekStart: data.weekStart, weekEnd: data.weekEnd, meta, count: n, kpis: buildKpis(n, null, null), summary: label };
    }

    if (intent === "detected_urls_delta") {
      const qs = ispFilter ? `?isp=${encodeURIComponent(ispFilter)}` : "";
      const data = await callDetectAPI<any>(`/nip/stats/isp/delta/today-vs-yesterday${qs}`);
      const todayCount = Number(data.todayCount || 0);
      const yesterdayCount = Number(data.yesterdayCount || 0);
      const delta = Number(data.delta || 0);
      const direction = delta > 0 ? "มากกว่า" : delta < 0 ? "น้อยกว่า" : "เท่ากัน";
      const ispLabel = ispFilter ? ispFilter.toUpperCase() : "ทั้งหมด";
      return {
        ok: true, intent, ispFilter: ispFilter || undefined, todayCount, yesterdayCount, delta, direction, today, yesterday: getBangkokDate(-1), meta,
        kpis: buildKpis(todayCount, ispLabel, delta),
        summary: `${ispLabel}: วันนี้ ${todayCount} / เมื่อวาน ${yesterdayCount} (${direction} ${Math.abs(delta)} รายการ)`,
      };
    }

    if (intent === "nip_top_isp_this_month") {
      const month = bkkMonth();
      const ispQs = ispFilter ? `&isp=${encodeURIComponent(ispFilter)}` : "";
      const data = await callDetectAPI<any>(`/nip/stats/top-isp/month?month=${month}&limit=10${ispQs}`);
      const byIsp = data.byIsp || [];
      const top = byIsp[0] || null;
      const total = Number(data.total || 0);
      return {
        ok: true, intent, month, ispFilter: ispFilter || undefined, byIsp, topIsp: top, meta,
        kpis: buildKpis(total, top?.isp ?? null, top?.count ?? null),
        table: { rows: byIsp },
        summary: ispFilter
          ? `เดือนนี้ (${month}) ${ispFilter.toUpperCase()}: ${total} รายการ`
          : (top ? `เดือนนี้ (${month}) ISP มากสุด: ${top.isp} (${top.count} รายการ)` : `เดือนนี้ยังไม่มีข้อมูล`),
      };
    }

    if (intent === "nip_top_isp_all") {
      const topN = Math.min(Math.max(1, Number(args.limit)||10), 10);
      const data = await callDetectAPI<any>(`/nip/stats/top-isp/all-time?limit=${topN}`);
      const byIsp = data.byIsp || [];
      const top = byIsp[0] || null;
      const total = Number(data.total || 0);
      return {
        ok: true, intent, topN, byIsp, topIsp: top, meta,
        kpis: buildKpis(total, top?.isp ?? null, top?.count ?? null),
        table: { rows: byIsp },
        summary: top ? `Top ISP ทั้งหมด: ${top.isp} (${top.count.toLocaleString()} รายการ)` : "ยังไม่มีข้อมูล",
      };
    }

    if (intent === "nip_latest") {
      const data = await callDetectAPI<any>(`/nip/latest?limit=${Math.min(limit, 10)}`);
      const items = data.items || [];
      const latest = items[0] || null;
      return {
        ok: true, intent, items, latest, meta,
        kpis: buildKpis(items.length, latest?.isp_name ?? null, null),
        summary: latest ? `URL ผิดกฎหมายล่าสุด: ${latest.url} (${latest.isp_name})` : "ไม่พบข้อมูล",
      };
    }

    if (intent === "nip_by_record_top") {
      const data = await callDetectAPI<any>(`/records/top-nip-by-record?limit=${Math.min(limit, 10)}`);
      const items = data.items || [];
      const top = items[0] || null;
      const total = items.reduce((s: number, r: any) => s + Number(r.count || 0), 0);
      return {
        ok: true, intent, items, top, meta,
        kpis: buildKpis(total, top ? `nip_no=${top.nip_no}` : null, top?.count ?? null),
        summary: top ? `NIP ที่มี record มากสุด: nip_no=${top.nip_no} (${top.count.toLocaleString()} รายการ)` : "ไม่พบข้อมูล",
      };
    }

    if (intent === "nip_unique_this_month") {
      const month = bkkMonth();
      const ispQs = ispFilter ? `&isp=${encodeURIComponent(ispFilter)}` : "";
      const data = await callDetectAPI<any>(`/nip/distinct/month?month=${month}${ispQs}`);
      const byIsp = data.byIsp || [];
      const total = Number(data.total || 0);
      return {
        ok: true, intent, month, ispFilter: ispFilter || undefined, byIsp, meta,
        kpis: buildKpis(total, byIsp[0]?.isp ?? null, byIsp[0]?.count ?? null),
        metric: "COUNT(DISTINCT url)",
        summary: `เดือนนี้ (${month}) URL ไม่ซ้ำ: ${total} รายการ${ispFilter ? ` (${ispFilter.toUpperCase()})` : ""}`,
      };
    }

    if (intent === "nip_latest_by_isp_month") {
      const month = bkkMonth();
      const ispQs = ispFilter ? `&isp=${encodeURIComponent(ispFilter)}` : "";
      const data = await callDetectAPI<any>(`/nip/latest?month=${month}&limit=${limit}${ispQs}`);
      const items = data.items || [];
      return {
        ok: true, intent, month, ispFilter: ispFilter || undefined, requestedLimit: limit, actualCount: items.length, items, meta,
        kpis: buildKpis(items.length, ispFilter ?? null, null),
        summary: `${month} URL ผิดกฎหมายล่าสุด${ispFilter ? ` ของ ${ispFilter.toUpperCase()}` : ""}: ${items.length} รายการ (ขอ ${limit})`,
      };
    }

    return { ok: false, code: "UNKNOWN_INTENT", meta: metaFor("placeholder"), message: `Unknown intent: ${String(intent)}` };
  } catch (error: any) {
    const code = String(error?.code || "").toUpperCase();
    if (code === "DETECT_API_UNAVAILABLE" || code === "MISSING_DETECT_DB_CREDS") {
      return buildMissingCreds(String(intent || "unknown"));
    }
    return buildErrorShell(String(intent || "unknown"), "EVIDENCE_QUERY_FAILED");
  }
}
