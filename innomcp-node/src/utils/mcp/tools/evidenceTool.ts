
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
          "pending_evidence",
          "recent_threats",
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

  const assertDetectDbCreds = (currentIntent?: string): { ok: true } | { ok: false; code: string; message: string } => {
    const host = process.env.DETECT_DB_HOST;
    const user = process.env.DETECT_DB_USER;
    const password = process.env.DETECT_DB_PASSWORD;
    const db = process.env.DETECT_DB_NAME;

    if (!host || !user || !password || !db) {
      return {
        ok: false,
        code: "MISSING_DETECT_DB_CREDS",
        message: "ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล Detect จึงยังไม่สามารถดึงสถิติหลักฐานจริงได้ในตอนนี้",
      };
    }
    return { ok: true };
  };

  const mockNoDb = (currentIntent: string) => {
    const base = {
      ok: true,
      intent: currentIntent,
      mock: true,
      code: "MOCK_NO_DB",
      note: "ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล Detect (แสดงผลแบบจำลอง/0 ชั่วคราว)",
    } as any;

    const today = getBangkokDate(0);
    const yesterday = getBangkokDate(-1);

    if (currentIntent === "active_evidence_machines" || currentIntent === "machine_status") {
      return { ...base, intent: "active_evidence_machines", count: 0, summary: "ตอนนี้เครื่องออนไลน์: 0 เครื่อง (ยังไม่เชื่อมต่อฐานข้อมูล)" };
    }
    if (currentIntent === "active_evidence_machines_offline") {
      return { ...base, count: 0, summary: "ตอนนี้เครื่องออฟไลน์: 0 เครื่อง (ยังไม่เชื่อมต่อฐานข้อมูล)" };
    }
    if (currentIntent === "machines_evidence_active_today") {
      return { ...base, date: today, count: 0, summary: "วันนี้ machine evidence ทำงาน: 0 เครื่อง (ยังไม่เชื่อมต่อฐานข้อมูล)" };
    }
    if (currentIntent === "evidence_records_today") {
      return { ...base, date: today, count: 0, summary: "วันนี้จัดเก็บหลักฐานวิดีโอได้: 0 รายการ (ยังไม่เชื่อมต่อฐานข้อมูล)" };
    }
    if (currentIntent === "evidence_records_yesterday_total") {
      return { ...base, date: yesterday, count: 0, summary: "เมื่อวานนี้จัดเก็บหลักฐานวิดีโอได้: 0 รายการ (ยังไม่เชื่อมต่อฐานข้อมูล)" };
    }
    if (currentIntent === "evidence_records_yesterday_by_isp_top") {
      const byIsp = [{ isp: "(ไม่สามารถระบุได้)", count: 0 }];
      return {
        ...base,
        date: yesterday,
        total: 0,
        byIsp,
        topIsp: byIsp[0],
        summary: "เมื่อวานนี้รวม 0 รายการ | ISP มากสุด: (ไม่สามารถระบุได้) (0) | หมายเหตุ: ยังไม่เชื่อมต่อฐานข้อมูล Detect",
      };
    }
    if (currentIntent === "pending_evidence") {
      return { ...base, date: today, count: 0, summary: "หลักฐานค้างดำเนินการวันนี้: 0 รายการ (ยังไม่เชื่อมต่อฐานข้อมูล)" };
    }
    if (currentIntent === "recent_threats") {
      return { ...base, date: today, count: 0, summary: "เหตุการณ์ (NIP) วันนี้: 0 รายการ (ยังไม่เชื่อมต่อฐานข้อมูล)" };
    }

    return { ...base, summary: "ยังไม่เชื่อมต่อฐานข้อมูล Detect" };
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
    if (!intent) {
      return { ok: false, code: "MISSING_INTENT", message: "intent is required" };
    }

    const creds = assertDetectDbCreds(intent);
    if (!creds.ok) {
      return mockNoDb(intent);
    }

    const today = getBangkokDate(0);
    const yesterday = getBangkokDate(-1);

    // 1) ตอนนี้เครื่องออนไลน์กี่เครื่อง → machines WHERE is_online=1
    if (intent === "active_evidence_machines" || intent === "machine_status") {
      const online = await countQuery("SELECT COUNT(*) as c FROM machines WHERE is_online = ?", [1]);
      return {
        ok: true,
        intent: intent === "machine_status" ? "active_evidence_machines" : intent,
        count: online,
        summary: `ตอนนี้เครื่องออนไลน์: ${online} เครื่อง`,
      };
    }

    // 1b) ตอนนี้เครื่องออฟไลน์กี่เครื่อง → machines WHERE is_online=0
    if (intent === "active_evidence_machines_offline") {
      const offline = await countQuery("SELECT COUNT(*) as c FROM machines WHERE is_online = ?", [0]);
      return {
        ok: true,
        intent,
        count: offline,
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
        count: n,
        dateColumn: dateCol,
        summary: `วันนี้ machine evidence ทำงาน: ${n} เครื่อง`,
      };
    }

    // 3) วันนี้จัดเก็บหลักฐานวิดีโอได้เท่าไหร่ → record WHERE DATE(create_date)=today (detect actual column)
    if (intent === "evidence_records_today") {
      const cols = await getColumns("record");
      const createdCol = pickFirstColumn(cols, ["create_date", "created_at", "created_date", "created_on", "timestamp"]);
      if (!createdCol) {
        return { ok: false, intent, code: "MISSING_DATE_COLUMN", table: "record", columns: cols };
      }
      const n = await countQuery(`SELECT COUNT(*) as c FROM record WHERE DATE(\`${createdCol}\`) = ?`, [today]);
      return {
        ok: true,
        intent,
        count: n,
        dateColumn: createdCol,
        summary: `วันนี้จัดเก็บหลักฐานวิดีโอได้: ${n} รายการ`,
      };
    }

    // Phase 7.3: เมื่อวาน evidence ได้เท่าไหร่
    if (intent === "evidence_records_yesterday_total") {
      const cols = await getColumns("record");
      const createdCol = pickFirstColumn(cols, ["create_date", "created_at", "created_date", "created_on", "timestamp"]);
      if (!createdCol) {
        return { ok: false, intent, code: "MISSING_DATE_COLUMN", table: "record", columns: cols };
      }
      const n = await countQuery(`SELECT COUNT(*) as c FROM record WHERE DATE(\`${createdCol}\`) = ?`, [yesterday]);
      return {
        ok: true,
        intent,
        date: yesterday,
        count: n,
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
      const nipNoCol = pickFirstColumn(nipCols, ["nip_no", "nipNo", "nip_id", "id"]);
      const ispCol = pickFirstColumn(nipCols, ["isp", "isp_name", "ispName", "provider", "provider_name", "operator", "operator_name"]);

      if (!createdCol) {
        return { ok: false, intent, code: "MISSING_DATE_COLUMN", table: "record", columns: recordCols };
      }

      // Always compute total (even if we cannot join)
      const total = await countQuery(`SELECT COUNT(*) as c FROM record WHERE DATE(\`${createdCol}\`) = ?`, [yesterday]);

      if (!recordNipCol || !nipNoCol || !ispCol) {
        return {
          ok: false,
          intent,
          code: "MISSING_REQUIRED_COLUMNS",
          date: yesterday,
          total,
          missing: {
            recordNipCol: recordNipCol || null,
            nipNoCol: nipNoCol || null,
            ispCol: ispCol || null,
          },
          summary:
            "ดึงยอดรวมเมื่อวานได้แล้ว แต่ยังไม่สามารถแยกตาม ISP ได้ เพราะ schema ของตาราง nip/record ไม่ตรงกับที่คาดไว้",
        };
      }

      const limit = Number(args?.limit || 10);
      const rows = await queryEvidence<any>(
        `SELECT n.\`${ispCol}\` as isp, COUNT(*) as c\n` +
          `FROM record r\n` +
          `JOIN nip n ON r.\`${recordNipCol}\` = n.\`${nipNoCol}\`\n` +
          `WHERE DATE(r.\`${createdCol}\`) = ?\n` +
          `GROUP BY n.\`${ispCol}\`\n` +
          `ORDER BY c DESC\n` +
          `LIMIT ?`,
        [yesterday, limit]
      );

      const byIsp = Array.isArray(rows)
        ? rows
            .map((r: any) => ({ isp: String(r.isp ?? "(ไม่ระบุ)").trim() || "(ไม่ระบุ)", count: Number(r.c || 0) || 0 }))
            .filter((r: any) => r.count >= 0)
        : [];

      const top = byIsp.length > 0 ? byIsp[0] : null;

      return {
        ok: true,
        intent,
        date: yesterday,
        total,
        byIsp,
        topIsp: top,
        summary: top
          ? `เมื่อวานนี้รวม ${total} รายการ | ISP มากสุด: ${top.isp} (${top.count})`
          : `เมื่อวานนี้รวม ${total} รายการ`,
      };
    }

    // Legacy intents (aggregation only; no raw rows)
    if (intent === "pending_evidence") {
      const nipCols = await getColumns("nip");
      const nipCreatedCol = pickFirstColumn(nipCols, ["create_date", "created_at", "created_date", "created_on", "timestamp"]);
      const nipNoCol = pickFirstColumn(nipCols, ["nip_no", "nipNo", "nip_id", "id"]);
      if (!nipCreatedCol || !nipNoCol) {
        return { ok: false, intent, code: "MISSING_REQUIRED_COLUMNS", table: "nip", columns: nipCols };
      }

      // Best-effort: count NIP created today where status_rec is NULL OR not in record.
      // This avoids returning any row-level details.
      const n = await countQuery(
        `SELECT COUNT(*) as c FROM nip WHERE DATE(\`${nipCreatedCol}\`) = ? AND (status_rec IS NULL OR \`${nipNoCol}\` NOT IN (SELECT \`${nipNoCol}\` FROM record))`,
        [today]
      );
      return { ok: true, intent, count: n, summary: `หลักฐานค้างดำเนินการวันนี้: ${n} รายการ` };
    }

    if (intent === "recent_threats") {
      const nipCols = await getColumns("nip");
      const nipCreatedCol = pickFirstColumn(nipCols, ["create_date", "created_at", "created_date", "created_on", "timestamp"]);
      if (!nipCreatedCol) {
        return { ok: false, intent, code: "MISSING_DATE_COLUMN", table: "nip", columns: nipCols };
      }
      const n = await countQuery(`SELECT COUNT(*) as c FROM nip WHERE DATE(\`${nipCreatedCol}\`) = ?`, [today]);
      return { ok: true, intent, count: n, summary: `เหตุการณ์ (NIP) วันนี้: ${n} รายการ` };
    }

    return { ok: false, code: "UNKNOWN_INTENT", message: `Unknown intent: ${String(intent)}` };
  } catch (error: any) {
    return {
      ok: false,
      code: "EVIDENCE_QUERY_FAILED",
      message: String(error?.message || error),
    };
  }
}
