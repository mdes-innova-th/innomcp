
import { MCPTool } from "../types";
import { queryEvidence } from "../../db/evidenceConnection";

export const EVIDENCE_TOOL_NAME = "detect_evidence_stats";

export const EVIDENCE_TOOL_DEF: MCPTool = {
  name: EVIDENCE_TOOL_NAME,
  description:
    "Officer evidence reporting tool (Detect DB). Aggregation-only (counts), parameterized SQL, optional schema detection when columns differ.",
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
        ],
        description: "The specific query intent to execute."
      },
      limit: {
        type: "number",
        description: "Optional limit for results (default 10)"
      }
    },
    required: ["intent"]
  }
};

export async function handleEvidenceTool(args: any): Promise<any> {
  const { intent } = args || {};

  type EvidenceDataSource = "detectdb" | "placeholder";

  const PLACEHOLDER_NOTE =
    "หมายเหตุ: ข้อมูลชุดนี้เป็นค่าตัวอย่าง (placeholder) เนื่องจากระบบฐานข้อมูลหลักฐานยังไม่พร้อมใช้งานครับ";

  const metaFor = (dataSource: EvidenceDataSource, note?: string) => {
    const meta: any = { dataSource };
    if (dataSource === "placeholder") {
      meta.note = String(note || PLACEHOLDER_NOTE);
    }
    return meta;
  };

  const placeholderIspTable = () => ({
    rows: [
      { isp: "(ยังไม่มีข้อมูล)", count: 0 },
      { isp: "(ยังไม่มีข้อมูล)", count: 0 },
      { isp: "(ยังไม่มีข้อมูล)", count: 0 },
      { isp: "อื่นๆ", count: 0 },
    ],
  });

  const buildKpis = (total: number, topIspName?: string | null, topIspCount?: number | null) => {
    const t = Number(total);
    return {
      total: Number.isFinite(t) ? t : 0,
      topIspName: topIspName ?? null,
      topIspCount: typeof topIspCount === "number" && Number.isFinite(topIspCount) ? topIspCount : null,
    };
  };

  const buildMissingCreds = (currentIntent: string) => {
    const base: any = {
      ok: false,
      code: "MISSING_DETECT_DB_CREDS",
      intent: currentIntent,
      meta: metaFor("placeholder"),
      message: "ขออภัย ขณะนี้ยังไม่พร้อมเชื่อมต่อฐานข้อมูลหลักฐาน กรุณาติดต่อผู้ดูแลระบบหรือลองใหม่ภายหลังครับ",
      kpis: buildKpis(0, null, null),
      table: {
        rows: [
          { isp: "(ยังไม่มีข้อมูล)", count: 0 },
          { isp: "(ยังไม่มีข้อมูล)", count: 0 },
          { isp: "(ยังไม่มีข้อมูล)", count: 0 },
          { isp: "อื่นๆ", count: 0 },
        ],
      },
    };

    if (currentIntent === "evidence_records_last_7_days_trend") {
      const end = getBangkokDate(0);
      const start = getBangkokDate(-6);
      base.range = { start, end };
      base.series = {
        label: "หลักฐานต่อวัน",
        points: Array.from({ length: 7 }).map((_, idx) => ({ date: getBangkokDate(-6 + idx), count: 0 })),
      };
    }

    return base;
  };

  const buildErrorShell = (currentIntent: string, code: string) => {
    const base: any = {
      ok: false,
      code,
      intent: currentIntent,
      meta: metaFor("placeholder"),
      message: "ขออภัย ระบบสืบค้นฐานข้อมูลหลักฐานขัดข้อง กรุณาลองใหม่อีกครั้งครับ",
      kpis: buildKpis(0, null, null),
    };

    if (currentIntent === "evidence_records_yesterday_by_isp_top") {
      base.table = {
        rows: [
          { isp: "(ยังไม่มีข้อมูล)", count: 0 },
          { isp: "(ยังไม่มีข้อมูล)", count: 0 },
          { isp: "(ยังไม่มีข้อมูล)", count: 0 },
          { isp: "อื่นๆ", count: 0 },
        ],
      };
    }

    if (currentIntent === "evidence_records_last_7_days_trend") {
      const end = getBangkokDate(0);
      const start = getBangkokDate(-6);
      base.range = { start, end };
      base.series = {
        label: "หลักฐานต่อวัน",
        points: Array.from({ length: 7 }).map((_, idx) => ({ date: getBangkokDate(-6 + idx), count: 0 })),
      };
    }

    return base;
  };

  const getBangkokDate = (offsetDays: number): string => {
    const now = new Date();
    const bkkMs = now.getTime() + 7 * 60 * 60 * 1000;
    const bkk = new Date(bkkMs);
    bkk.setUTCDate(bkk.getUTCDate() + offsetDays);
    const yyyy = bkk.getUTCFullYear();
    const mm = String(bkk.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(bkk.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const toYmd = (value: any, fallback: string): string => {
    const raw = String(value ?? "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : fallback;
  };

  const pickFirstColumn = (cols: string[], candidates: string[]): string | undefined => {
    const lower = new Map(cols.map((c) => [c.toLowerCase(), c] as const));
    for (const want of candidates) {
      const found = lower.get(want.toLowerCase());
      if (found) return found;
    }
    return undefined;
  };

  const getColumns = async (table: string): Promise<string[]> => {
    const rows = await queryEvidence<any>(`SHOW COLUMNS FROM \`${table}\``);
    return Array.isArray(rows)
      ? rows.map((r: any) => String(r.Field || r.field || "").trim()).filter(Boolean)
      : [];
  };

  const countQuery = async (sql: string, params: any[] = []): Promise<number> => {
    const rows = await queryEvidence<any>(sql, params);
    const n = Number((rows?.[0] as any)?.c ?? (rows?.[0] as any)?.count ?? (rows?.[0] as any)?.total ?? 0) || 0;
    return n;
  };

  try {
    if (process.env.TEST_DEGRADE_DB === "1") throw Object.assign(new Error("DB_DEGRADED"), { code: "MISSING_DETECT_DB_CREDS" });
    if (process.env.TEST_DEGRADE_WEBDDSB === "1") throw Object.assign(new Error("WEBDDSB_DEGRADED"), { code: "WEBDDSB_UNAVAILABLE" });

    if (!intent) {
      return { ok: false, code: "MISSING_INTENT", meta: metaFor("placeholder"), message: "intent is required" };
    }

    const today = getBangkokDate(0);
    const yesterday = getBangkokDate(-1);

    // 1) ตอนนี้เครื่องออนไลน์กี่เครื่อง → machines WHERE is_online=1
    if (intent === "active_evidence_machines" || intent === "machine_status") {
      const online = await countQuery("SELECT COUNT(*) as c FROM machines WHERE is_online = ?", [1]);
      return {
        ok: true,
        intent: intent === "machine_status" ? "active_evidence_machines" : intent,
        meta: metaFor("detectdb"),
        count: online,
        kpis: buildKpis(online, null, null),
        summary: `ตอนนี้เครื่องออนไลน์: ${online} เครื่อง`,
      };
    }

    // 1b) ตอนนี้เครื่องออฟไลน์กี่เครื่อง → machines WHERE is_online=0
    if (intent === "active_evidence_machines_offline") {
      const offline = await countQuery("SELECT COUNT(*) as c FROM machines WHERE is_online = ?", [0]);
      return {
        ok: true,
        intent,
        meta: metaFor("detectdb"),
        count: offline,
        kpis: buildKpis(offline, null, null),
        summary: `ตอนนี้เครื่องออฟไลน์: ${offline} เครื่อง`,
      };
    }

    // 2) วันนี้ machine evidence ทำงานอยู่กี่เครื่อง
    if (intent === "machines_evidence_active_today") {
      const cols = await getColumns("machines");
      const dateCol = pickFirstColumn(cols, ["last_check_in", "create_datetime"]);
      const onlineCol = pickFirstColumn(cols, ["is_online", "online", "isOnline"]);
      if (!dateCol) {
        // Schema detect step: return only column names (no rows)
        return {
          ok: false,
          intent,
          code: "MISSING_DATE_COLUMN",
          meta: metaFor("placeholder"),
          table: "machines",
          columns: cols,
        };
      }

      const n = onlineCol
        ? await countQuery(
            `SELECT COUNT(*) as c FROM machines WHERE DATE(\`${dateCol}\`) = ? AND \`${onlineCol}\` = ?`,
            [today, 1]
          )
        : await countQuery(`SELECT COUNT(*) as c FROM machines WHERE DATE(\`${dateCol}\`) = ?`, [today]);
      return {
        ok: true,
        intent,
        meta: metaFor("detectdb"),
        count: n,
        kpis: buildKpis(n, null, null),
        dateColumn: dateCol,
        summary: `วันนี้ machine evidence ทำงาน: ${n} เครื่อง`,
      };
    }

    // 3) วันนี้จัดเก็บหลักฐานวิดีโอได้เท่าไหร่ → record WHERE DATE(create_date)=today (detect actual column)
    if (intent === "evidence_records_today") {
      const cols = await getColumns("record");
      const createdCol = pickFirstColumn(cols, ["create_date", "created_at", "created_date", "created_on", "timestamp"]);
      if (!createdCol) {
        return { ok: false, intent, code: "MISSING_DATE_COLUMN", meta: metaFor("placeholder"), table: "record", columns: cols };
      }
      const n = await countQuery(`SELECT COUNT(*) as c FROM record WHERE DATE(\`${createdCol}\`) = ?`, [today]);
      return {
        ok: true,
        intent,
        meta: metaFor("detectdb"),
        count: n,
        kpis: buildKpis(n, null, null),
        dateColumn: createdCol,
        summary: `วันนี้จัดเก็บหลักฐานวิดีโอได้: ${n} รายการ`,
      };
    }

    // Phase 7.3: เมื่อวาน evidence ได้เท่าไหร่
    if (intent === "evidence_records_yesterday_total") {
      const cols = await getColumns("record");
      const createdCol = pickFirstColumn(cols, ["create_date", "created_at", "created_date", "created_on", "timestamp"]);
      if (!createdCol) {
        return { ok: false, intent, code: "MISSING_DATE_COLUMN", meta: metaFor("placeholder"), table: "record", columns: cols };
      }
      const n = await countQuery(`SELECT COUNT(*) as c FROM record WHERE DATE(\`${createdCol}\`) = ?`, [yesterday]);
      return {
        ok: true,
        intent,
        meta: metaFor("detectdb"),
        date: yesterday,
        count: n,
        kpis: buildKpis(n, null, null),
        dateColumn: createdCol,
        summary: `เมื่อวานนี้จัดเก็บหลักฐานวิดีโอได้: ${n} รายการ`,
      };
    }

    // Phase 7.3: เมื่อวาน evidence แยกตาม ISP + ใครมากสุด
    if (intent === "evidence_records_yesterday_by_isp_top") {
      const recordCols = await getColumns("record");
      const nipCols = await getColumns("nip");

      const createdCol = pickFirstColumn(recordCols, ["create_date", "created_at", "created_date", "created_on", "timestamp"]);
      const recordNipCol = pickFirstColumn(recordCols, ["nip_no", "nipNo", "nip_id", "nipId", "nip", "id_nip"]);
      const nipNoCol = pickFirstColumn(nipCols, ["no", "nip_no", "nipNo", "nip_id", "id"]);
      const ispCol = pickFirstColumn(nipCols, ["isp", "isp_name", "ispName", "provider", "provider_name", "operator", "operator_name"]);

      if (!createdCol) {
        return {
          ok: false,
          intent,
          code: "MISSING_DATE_COLUMN",
          meta: metaFor("placeholder"),
          dbTable: "record",
          columns: recordCols,
          kpis: buildKpis(0, null, null),
          tableShape: "isp_top3_plus_others",
          table: placeholderIspTable(),
          summary: "ยังไม่สามารถสรุปแยกตาม ISP ได้ เพราะไม่พบคอลัมน์วันที่ในตาราง record",
        };
      }

      // Always compute total (even if we cannot join)
      const total = await countQuery(`SELECT COUNT(*) as c FROM record WHERE DATE(\`${createdCol}\`) = ?`, [yesterday]);

      if (!recordNipCol || !nipNoCol || !ispCol) {
        return {
          ok: false,
          intent,
          code: "MISSING_REQUIRED_COLUMNS",
          meta: metaFor("placeholder"),
          date: yesterday,
          total,
          kpis: buildKpis(total, null, null),
          tableShape: "isp_top3_plus_others",
          table: placeholderIspTable(),
          missing: {
            recordNipCol: recordNipCol || null,
            nipNoCol: nipNoCol || null,
            ispCol: ispCol || null,
          },
          summary:
            "ดึงยอดรวมเมื่อวานได้แล้ว แต่ยังไม่สามารถแยกตาม ISP ได้ เพราะ schema ของตาราง nip/record ไม่ตรงกับที่คาดไว้",
        };
      }

      const rows = await queryEvidence<any>(
        `SELECT n.\`${ispCol}\` as isp, COUNT(*) as c\n` +
          `FROM record r\n` +
          `JOIN nip n ON r.\`${recordNipCol}\` = n.\`${nipNoCol}\`\n` +
          `WHERE DATE(r.\`${createdCol}\`) = ?\n` +
          `GROUP BY n.\`${ispCol}\`\n` +
          `ORDER BY c DESC\n` +
          `LIMIT 3`,
        [yesterday]
      );

      const byIsp = Array.isArray(rows)
        ? rows
            .map((r: any) => ({ isp: String(r.isp ?? "(ไม่ระบุ)").trim() || "(ไม่ระบุ)", count: Number(r.c || 0) || 0 }))
            .filter((r: any) => r.count >= 0)
        : [];

      const top = byIsp.length > 0 ? byIsp[0] : null;

      const sumTop = byIsp.reduce((acc: number, r: any) => acc + (Number(r.count) || 0), 0);
      const others = Math.max(0, total - sumTop);

      const tableRows: Array<{ isp: string; count: number }> = (() => {
        const out = byIsp.slice(0, 3);
        while (out.length < 3) out.push({ isp: "(ยังไม่มีข้อมูล)", count: 0 });
        out.push({ isp: "อื่นๆ", count: others });
        return out;
      })();

      return {
        ok: true,
        intent,
        meta: metaFor("detectdb"),
        date: yesterday,
        total,
        byIsp: tableRows,
        topIsp: top,
        kpis: buildKpis(total, top ? top.isp : null, top ? top.count : null),
        table: { rows: tableRows },
        summary: top
          ? `เมื่อวานนี้รวม ${total} รายการ | ISP มากสุด: ${top.isp} (${top.count})`
          : `เมื่อวานนี้รวม ${total} รายการ`,
      };
    }

    if (intent === "evidence_records_last_7_days_trend") {
      const cols = await getColumns("record");
      const createdCol = pickFirstColumn(cols, ["create_date", "created_at", "created_date", "created_on", "timestamp"]);
      if (!createdCol) {
        return { ok: false, intent, code: "MISSING_DATE_COLUMN", meta: metaFor("placeholder"), table: "record", columns: cols };
      }

      const end = getBangkokDate(0);
      const start = getBangkokDate(-6);
      const rows = await queryEvidence<any>(
        `SELECT DATE_FORMAT(\`${createdCol}\`, '%Y-%m-%d') as d, COUNT(*) as c FROM record WHERE DATE(\`${createdCol}\`) BETWEEN ? AND ? GROUP BY d ORDER BY d ASC`,
        [start, end]
      );

      const byDate = new Map<string, number>();
      if (Array.isArray(rows)) {
        for (const r of rows) {
          const d = toYmd(r?.d, "");
          const c = Number(r?.c || 0) || 0;
          if (d) byDate.set(d, c);
        }
      }

      const points = Array.from({ length: 7 }).map((_, idx) => {
        const date = toYmd(getBangkokDate(-6 + idx), getBangkokDate(-6 + idx));
        return { date, count: byDate.get(date) ?? 0 };
      });
      const total = points.reduce((acc, p) => acc + (Number(p.count) || 0), 0);

      return {
        ok: true,
        intent,
        meta: metaFor("detectdb"),
        range: { start, end },
        kpis: buildKpis(total, null, null),
        series: { label: "หลักฐานต่อวัน", points },
        dateColumn: createdCol,
        summary: `แนวโน้ม 7 วันล่าสุด: รวม ${total} รายการ`,
      };
    }

    // Legacy intents (aggregation only; no raw rows)
    if (intent === "pending_evidence") {
      const nipCols = await getColumns("nip");
      const nipCreatedCol = pickFirstColumn(nipCols, ["create_date", "created_at", "created_date", "created_on", "timestamp"]);
      const nipNoCol = pickFirstColumn(nipCols, ["no", "nip_no", "nipNo", "nip_id", "id"]);
      if (!nipCreatedCol || !nipNoCol) {
        return { ok: false, intent, code: "MISSING_REQUIRED_COLUMNS", meta: metaFor("placeholder"), table: "nip", columns: nipCols };
      }

      // Best-effort: count NIP created today where status_rec is NULL OR not in record.
      // This avoids returning any row-level details.
      const n = await countQuery(
        `SELECT COUNT(*) as c FROM nip WHERE DATE(\`${nipCreatedCol}\`) = ? AND (status_rec IS NULL OR \`${nipNoCol}\` NOT IN (SELECT \`${nipNoCol}\` FROM record))`,
        [today]
      );
      return { ok: true, intent, meta: metaFor("detectdb"), count: n, kpis: buildKpis(n, null, null), summary: `หลักฐานค้างดำเนินการวันนี้: ${n} รายการ` };
    }

    if (intent === "recent_threats") {
      const nipCols = await getColumns("nip");
      const nipCreatedCol = pickFirstColumn(nipCols, ["create_date", "created_at", "created_date", "created_on", "timestamp"]);
      if (!nipCreatedCol) {
        return { ok: false, intent, code: "MISSING_DATE_COLUMN", meta: metaFor("placeholder"), table: "nip", columns: nipCols };
      }
      const n = await countQuery(`SELECT COUNT(*) as c FROM nip WHERE DATE(\`${nipCreatedCol}\`) = ?`, [today]);
      return { ok: true, intent, meta: metaFor("detectdb"), count: n, kpis: buildKpis(n, null, null), summary: `เหตุการณ์ (NIP) วันนี้: ${n} รายการ` };
    }

    if (intent === "detected_urls_today") {
      const n = await countQuery(`SELECT COUNT(*) as c FROM nip WHERE DATE(create_date) = ?`, [today]);
      return { ok: true, intent, meta: metaFor("detectdb"), count: n, kpis: buildKpis(n, null, null), dateColumn: "create_date", summary: `วันนี้ตรวจพบ URL/NIP: ${n} รายการ` };
    }

    if (intent === "nip_top_isp_this_month") {
      const now = new Date();
      const yr = now.getFullYear();
      const mo = now.getMonth() + 1;
      const monthLabel = `${yr}-${String(mo).padStart(2,"0")}`;
      const rows = await queryEvidence<any>(
        "SELECT isp_name, COUNT(*) as c FROM nip WHERE YEAR(create_date)=? AND MONTH(create_date)=? GROUP BY isp_name ORDER BY c DESC LIMIT 10",
        [yr, mo]
      );
      const byIsp = Array.isArray(rows) ? rows.map((r:any) => ({ isp: String(r.isp_name||"ไม่ระบุ").trim()||"ไม่ระบุ", count: Number(r.c||0) })) : [];
      const top = byIsp[0] || null;
      const total = byIsp.reduce((acc: number, r: any) => acc + (Number(r.count) || 0), 0);
      return {
        ok: true, intent, month: monthLabel, byIsp, topIsp: top, meta: metaFor("detectdb"),
        kpis: buildKpis(total, top ? top.isp : null, top ? top.count : null),
        table: { rows: byIsp },
        summary: top ? `เดือนนี้ (${monthLabel}) ISP มากสุด: ${top.isp} (${top.count} รายการ)` : `เดือนนี้ยังไม่มีข้อมูล`,
      };
    }

    if (intent === "nip_top_isp_all") {
      const topN = Math.min(Math.max(1, Number(args.limit)||10), 10);
      const rows = await queryEvidence<any>(
        `SELECT isp_name, COUNT(*) as c FROM nip GROUP BY isp_name ORDER BY c DESC LIMIT ${topN}`
      );
      const byIsp = Array.isArray(rows) ? rows.map((r:any) => ({ isp: String(r.isp_name||"ไม่ระบุ").trim()||"ไม่ระบุ", count: Number(r.c||0) })) : [];
      const top = byIsp[0] || null;
      const total = byIsp.reduce((acc: number, r: any) => acc + (Number(r.count) || 0), 0);
      return {
        ok: true, intent, topN, byIsp, topIsp: top, meta: metaFor("detectdb"),
        kpis: buildKpis(total, top ? top.isp : null, top ? top.count : null),
        table: { rows: byIsp },
        summary: top ? `Top ISP ทั้งหมด: ${top.isp} (${top.count.toLocaleString()} รายการ)` : "ยังไม่มีข้อมูล",
      };
    }

    if (intent === "machine_last_scan") {
      const rows = await queryEvidence<any>(
        "SELECT pc_name, isp_name, ip_address, last_check_in, is_online FROM machines ORDER BY last_check_in DESC LIMIT 5"
      );
      const machines = Array.isArray(rows) ? rows.map((r:any) => ({
        pc_name: String(r.pc_name||"(ไม่ระบุ)"),
        isp_name: String(r.isp_name||"(ไม่ระบุ)"),
        ip_address: String(r.ip_address||""),
        last_check_in: r.last_check_in ? new Date(r.last_check_in).toISOString() : null,
        is_online: Number(r.is_online||0) === 1,
      })) : [];
      const latest = machines[0] || null;
      return {
        ok: true, intent, machines, latest, meta: metaFor("detectdb"),
        kpis: buildKpis(machines.length, latest ? latest.isp_name : null, null),
        summary: latest ? `เครื่องสแกนล่าสุด: ${latest.pc_name} (${latest.isp_name}) ตรวจสอบล่าสุด ${latest.last_check_in?.slice(0,10)||"-"}` : "ไม่พบข้อมูล",
      };
    }

    if (intent === "nip_latest") {
      const topN = Math.min(Math.max(1, Number(args.limit)||5), 10);
      const rows = await queryEvidence<any>(
        `SELECT no, url, isp_name, create_date FROM nip ORDER BY create_date DESC LIMIT ${topN}`
      );
      const items = Array.isArray(rows) ? rows.map((r:any) => ({
        no: Number(r.no||0),
        url: String(r.url||""),
        isp_name: String(r.isp_name||""),
        create_date: r.create_date ? new Date(r.create_date).toISOString() : null,
      })) : [];
      const latest = items[0] || null;
      return {
        ok: true, intent, items, latest, meta: metaFor("detectdb"),
        kpis: buildKpis(items.length, latest ? latest.isp_name : null, null),
        summary: latest ? `URL ผิดกฎหมายล่าสุด: ${latest.url} (${latest.isp_name})` : "ไม่พบข้อมูล",
      };
    }

    if (intent === "nip_by_record_top") {
      const topN = Math.min(Math.max(1, Number(args.limit)||10), 10);
      const rows = await queryEvidence<any>(
        `SELECT nip_no, COUNT(*) as c FROM record GROUP BY nip_no ORDER BY c DESC LIMIT ${topN}`
      );
      const items = Array.isArray(rows) ? rows.map((r:any) => ({ nip_no: Number(r.nip_no||0), count: Number(r.c||0) })) : [];
      const top = items[0] || null;
      const total = items.reduce((acc: number, r: any) => acc + (Number(r.count) || 0), 0);
      return {
        ok: true, intent, items, top, meta: metaFor("detectdb"),
        kpis: buildKpis(total, top ? `nip_no=${top.nip_no}` : null, top ? top.count : null),
        summary: top ? `NIP ที่มี record มากสุด: nip_no=${top.nip_no} (${top.count.toLocaleString()} รายการ)` : "ไม่พบข้อมูล",
      };
    }

    return { ok: false, code: "UNKNOWN_INTENT", meta: metaFor("placeholder"), message: `Unknown intent: ${String(intent)}` };
  } catch (error: any) {
    const code = String(error?.code || "").toUpperCase();
    if (code === "MISSING_DETECT_DB_CREDS") {
      return buildMissingCreds(String(intent || "unknown"));
    }

    // Keep schema deterministic even on failures (no raw error details).
    return buildErrorShell(String(intent || "unknown"), "EVIDENCE_QUERY_FAILED");
  }
}
