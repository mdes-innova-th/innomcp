
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

  const assertDetectDbCreds = (): { ok: true } | { ok: false; code: string; message: string } => {
    const host = process.env.DETECT_DB_HOST;
    const user = process.env.DETECT_DB_USER;
    const password = process.env.DETECT_DB_PASSWORD;
    const db = process.env.DETECT_DB_NAME;

    if (!host || !user || !password || !db) {
      return {
        ok: false,
        code: "MISSING_DETECT_DB_CREDS",
        message: "Detect DB is not configured. Please set DETECT_DB_HOST/USER/PASSWORD/NAME.",
      };
    }
    return { ok: true };
  };

  const getBangkokToday = (): string => {
    const now = new Date();
    const bkkMs = now.getTime() + 7 * 60 * 60 * 1000;
    const bkk = new Date(bkkMs);
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

    const creds = assertDetectDbCreds();
    if (!creds.ok) {
      return { ok: false, intent, code: creds.code, message: creds.message };
    }

    const today = getBangkokToday();

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
