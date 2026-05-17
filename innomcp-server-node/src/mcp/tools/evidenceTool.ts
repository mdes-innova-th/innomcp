/**
 * Evidence Tool — THIN MCP ADAPTER (Phase 19)
 *
 * This file contains NO business SQL. All queries are delegated to
 * the detect-evidence-api microservice on port 3013.
 *
 * Architecture: MCP Tool -> HTTP -> detect-evidence-api -> MySQL
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logBoth } from "../../utils/mcpLogger";

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

/** Bangkok month helper (YYYY-MM) */
function bkkMonth(): string {
  const d = new Date(Date.now() + 7 * 3600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Build structured MCP response */
function mcpText(text: string, structured?: any) {
  return {
    content: [{ type: "text" as const, text }],
    ...(structured ? { structuredContent: structured } : {}),
  };
}

/** Error wrapper */
function mcpError(action: string, code: string, message: string) {
  return mcpText(
    "ขออภัย ระบบสืบค้นฐานข้อมูลหลักฐานขัดข้อง กรุณาลองใหม่อีกครั้งครับ",
    { ok: false, intent: action, code, message, meta: { dataSource: "detect-api" } }
  );
}

export const evidenceTool = {
  name: "evidenceTool",
  description:
    "Officer evidence reporting tool (Detect DB via detect-evidence-api). Thin MCP adapter — all queries delegated to API.",
  inputSchema: z.object({
    action: z
      .enum([
        "active_machines_count",
        "active_machines_offline_count",
        "machines_evidence_active_today",
        "evidence_records_today",
        "evidence_records_yesterday_total",
        "evidence_records_yesterday_by_isp_top",
        "evidence_records_last_7_days_trend",
        "detected_urls_today",
        "officer_summary",
        "list_tables",
        "describe_table",
        "nip_top_isp_this_month",
        "nip_top_isp_all",
        "machine_last_scan",
        "nip_latest",
        "nip_by_record_top",
      ])
      .describe("Action to perform"),
    tableName: z
      .enum(["machines", "nip", "record", "entries", "sip"])
      .optional()
      .describe("Table name for describe/query actions (whitelisted)"),
    limit: z
      .number()
      .optional()
      .default(5)
      .describe("Limit number of rows (default 5, max 20)"),
    ispFilter: z
      .string()
      .optional()
      .describe("Optional ISP name filter (e.g. dtac, ais, true, tot, 3bb, nt)"),
  }),
  execute: async (args: any) => {
    const { action, tableName, limit } = args;
    const safeLimit = Math.min(Math.max(1, limit || 5), 20);
    const ispFilter = args.ispFilter ? String(args.ispFilter).trim() : null;
    const meta = { dataSource: "detect-api" as const };

    try {
      // ===== MACHINES =====
      if (action === "active_machines_count") {
        const data = await callDetectAPI<any>("/machines/active");
        const n = Number(data.count || 0);
        return mcpText(`ตอนนี้เครื่องออนไลน์: ${n} เครื่อง`, { ok: true, intent: action, count: n, meta });
      }

      if (action === "active_machines_offline_count") {
        const data = await callDetectAPI<any>("/machines/offline");
        const n = Number(data.count || 0);
        return mcpText(`ตอนนี้เครื่องออฟไลน์: ${n} เครื่อง`, { ok: true, intent: action, count: n, meta });
      }

      if (action === "machines_evidence_active_today") {
        const data = await callDetectAPI<any>("/machines/status");
        const n = Number(data.online || 0);
        return mcpText(`วันนี้ machine evidence ทำงาน: ${n} เครื่อง`, { ok: true, intent: action, count: n, meta });
      }

      if (action === "machine_last_scan") {
        const data = await callDetectAPI<any>("/machines/latest?limit=5");
        const items = data.items || [];
        const latest = items[0] || null;
        const text = latest
          ? `เครื่องสแกนล่าสุด: ${latest.pc_name} (${latest.isp_name}) ตรวจสอบล่าสุด ${String(latest.last_check_in || "").slice(0, 16) || "-"}`
          : "ไม่พบข้อมูล";
        return mcpText(text, { ok: true, intent: action, machines: items, latest, meta });
      }

      // ===== RECORD / EVIDENCE =====
      if (action === "evidence_records_today") {
        const data = await callDetectAPI<any>("/records/count/today");
        const n = Number(data.count || 0);
        return mcpText(`วันนี้จัดเก็บหลักฐานวิดีโอแล้ว: ${n} รายการ`, { ok: true, intent: action, count: n, date: data.date, meta });
      }

      if (action === "evidence_records_yesterday_total") {
        const data = await callDetectAPI<any>("/records/count/yesterday");
        const n = Number(data.count || 0);
        return mcpText(`เมื่อวานนี้จัดเก็บหลักฐานวิดีโอได้: ${n} รายการ`, { ok: true, intent: action, count: n, date: data.date, meta });
      }

      if (action === "evidence_records_yesterday_by_isp_top") {
        const data = await callDetectAPI<any>("/records/count/yesterday/by-isp");
        const byIsp = data.byIsp || [];
        const total = Number(data.total || 0);
        const top = byIsp[0] || null;
        const tableRows = byIsp.slice(0, 3);
        while (tableRows.length < 3) tableRows.push({ isp: "(ยังไม่มีข้อมูล)", count: 0 });
        const sumTop = tableRows.reduce((s: number, r: any) => s + Number(r.count || 0), 0);
        tableRows.push({ isp: "อื่นๆ", count: Math.max(0, total - sumTop) });
        const text = top
          ? `เมื่อวานนี้รวม ${total} รายการ | ISP มากสุด: ${top.isp} (${top.count})`
          : `เมื่อวานนี้รวม ${total} รายการ`;
        return mcpText(text, {
          ok: true, intent: action, date: data.date, total, byIsp: tableRows, topIsp: top,
          kpis: { total, topIspName: top?.isp ?? null, topIspCount: top?.count ?? null },
          table: { rows: tableRows }, meta,
        });
      }

      if (action === "evidence_records_last_7_days_trend") {
        const data = await callDetectAPI<any>("/records/trend/7days");
        const points = data.points || [];
        const total = Number(data.total || 0);
        const lines = points.map((p: any) => `${p.date}: ${p.count}`);
        return mcpText(
          `แนวโน้มหลักฐาน 7 วันล่าสุด:\n${lines.join("\n")}\nรวม 7 วัน: ${total} รายการ`,
          { ok: true, intent: action, range: { start: data.start, end: data.end }, series: { label: "หลักฐานต่อวัน", points }, total, meta }
        );
      }

      // ===== NIP =====
      if (action === "detected_urls_today") {
        const qs = ispFilter ? `?isp=${encodeURIComponent(ispFilter)}` : "";
        const data = await callDetectAPI<any>(`/nip/stats/isp/today${qs}`);
        const n = Number(data.count || 0);
        const label = ispFilter
          ? `วันนี้ตรวจพบ URL จาก ${ispFilter.toUpperCase()} แล้ว: ${n} รายการ`
          : `วันนี้ตรวจพบ URL แล้ว: ${n} รายการ`;
        return mcpText(label, { ok: true, intent: action, count: n, ispFilter: ispFilter || undefined, date: data.date, meta });
      }

      if (action === "nip_top_isp_this_month") {
        const month = bkkMonth();
        const ispQs = ispFilter ? `&isp=${encodeURIComponent(ispFilter)}` : "";
        const data = await callDetectAPI<any>(`/nip/stats/top-isp/month?month=${month}&limit=10${ispQs}`);
        const byIsp = data.byIsp || [];
        const top = byIsp[0] || null;
        const total = Number(data.total || 0);
        const text = ispFilter
          ? `เดือนนี้ (${month}) ${ispFilter.toUpperCase()}: ${total} รายการ`
          : (top ? `เดือนนี้ (${month}) ISP มากสุด: ${top.isp} (${top.count} รายการ)` : `เดือนนี้ยังไม่มีข้อมูล`);
        return mcpText(text, {
          ok: true, intent: action, month, ispFilter: ispFilter || undefined, byIsp, topIsp: top,
          kpis: { total, topIspName: top?.isp ?? null, topIspCount: top?.count ?? null },
          table: { rows: byIsp }, meta,
        });
      }

      if (action === "nip_top_isp_all") {
        const data = await callDetectAPI<any>(`/nip/stats/top-isp/all-time?limit=${safeLimit}`);
        const byIsp = data.byIsp || [];
        const top = byIsp[0] || null;
        const total = Number(data.total || 0);
        const text = top ? `Top ISP ทั้งหมด: ${top.isp} (${top.count} รายการ)` : "ยังไม่มีข้อมูล";
        return mcpText(text, {
          ok: true, intent: action, topN: safeLimit, byIsp, topIsp: top,
          kpis: { total, topIspName: top?.isp ?? null, topIspCount: top?.count ?? null },
          table: { rows: byIsp }, meta,
        });
      }

      if (action === "nip_latest") {
        const data = await callDetectAPI<any>(`/nip/latest?limit=${safeLimit}`);
        const items = data.items || [];
        const latest = items[0] || null;
        const text = latest ? `URL ผิดกฎหมายล่าสุด: ${latest.url} (${latest.isp_name})` : "ไม่พบข้อมูล";
        return mcpText(text, { ok: true, intent: action, items, latest, meta });
      }

      if (action === "nip_by_record_top") {
        const data = await callDetectAPI<any>(`/records/top-nip-by-record?limit=${safeLimit}`);
        const items = data.items || [];
        const top = items[0] || null;
        const text = top ? `NIP ที่มี record มากสุด: nip_no=${top.nip_no} (${top.count} รายการ)` : "ไม่พบข้อมูล";
        return mcpText(text, { ok: true, intent: action, items, top, meta });
      }

      // ===== OFFICER SUMMARY =====
      if (action === "officer_summary") {
        const data = await callDetectAPI<any>("/records/officer-summary");
        const lines: string[] = [
          `สรุปข้อมูลเจ้าหน้าที่ (วันที่ ${data.date})`,
          `- Machine online: ${data.machines?.online ?? "?"} เครื่อง`,
          `- Machine offline: ${data.machines?.offline ?? "?"} เครื่อง`,
          `- วันนี้จัดเก็บหลักฐานวิดีโอได้ทั้งหมด: ${data.records?.today ?? "?"} รายการ`,
          `- เหตุการณ์ NIP วันนี้: ${data.nip?.today ?? "?"} รายการ`,
        ];
        return mcpText(lines.join("\n"), { ok: true, intent: action, ...data, meta });
      }

      // ===== SCHEMA DISCOVERY =====
      if (action === "list_tables") {
        const data = await callDetectAPI<any>("/admin/tables");
        const tables = data.tables || [];
        return mcpText(tables.length > 0 ? tables.join("\n") : "(no tables)", { ok: true, intent: action, tables, meta });
      }

      if (action === "describe_table") {
        if (!tableName) return mcpError(action, "MISSING_TABLE", "tableName is required");
        const data = await callDetectAPI<any>(`/admin/describe/${encodeURIComponent(tableName)}`);
        const columns = data.columns || [];
        return mcpText(columns.length > 0 ? columns.join(",") : "(no columns)", { ok: true, intent: action, table: tableName, columns, meta });
      }

      return mcpText("Invalid action", { ok: false, intent: action, code: "UNKNOWN_ACTION", meta });
    } catch (error: any) {
      logBoth("ERROR", `[EvidenceTool] action=${action} error=${error.message}`);
      return mcpError(action, "DETECT_API_ERROR", error.message);
    }
  },
};

export function registerEvidenceTool(server: McpServer) {
  server.registerTool(
    evidenceTool.name,
    {
      title: "Evidence Tool (Detect DB via API)",
      description: evidenceTool.description,
      inputSchema: evidenceTool.inputSchema as any,
    },
    evidenceTool.execute,
  );
}
