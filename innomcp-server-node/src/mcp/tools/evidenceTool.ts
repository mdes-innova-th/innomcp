import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { queryDetect } from "../../utils/dbDetect";
import { logBoth } from "../../utils/mcpLogger";

export const evidenceTool = {
  name: "evidenceTool",
  description:
    "Officer evidence reporting tool (Detect DB). Provides parameterized queries for machines/nip/record and safe discovery helpers.",
  inputSchema: z.object({
    action: z
      .enum([
        "active_machines_count",
        "active_machines_offline_count",
        "machines_evidence_active_today",
        "evidence_records_today",
        "detected_urls_today",
        "officer_summary",
        "list_tables",
        "describe_table",
      ])
      .describe("Action to perform"),
    tableName: z
      .enum(["machines", "nip", "record", "entries"])
      .optional()
      .describe("Table name for describe/query actions (whitelisted)"),
    limit: z
      .number()
      .optional()
      .default(5)
      .describe("Limit number of rows (default 5, max 20)"),
  }),
  execute: async (args: any) => {
    const { action, tableName, limit } = args;
    const safeLimit = Math.min(Math.max(1, limit || 5), 20);

    const assertDetectDbCreds = (): { ok: true } | { ok: false; code: string; message: string } => {
      const host = process.env.DETECT_DB_HOST;
      const user = process.env.DETECT_DB_USER;
      const password = process.env.DETECT_DB_PASSWORD;
      const db = process.env.DETECT_DB_NAME;

      // We require explicit env for officer evidence flows (fail fast + structured).
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
      const rows = await queryDetect<any>(`SHOW COLUMNS FROM \`${table}\``);
      const cols = Array.isArray(rows) ? rows.map((r: any) => String(r.Field || r.field || "").trim()).filter(Boolean) : [];
      return cols;
    };

    const countQuery = async (sql: string, params: any[], label: string): Promise<number> => {
      const rows = await queryDetect<any>(sql, params);
      const n = Number((rows?.[0] as any)?.c ?? (rows?.[0] as any)?.count ?? (rows?.[0] as any)?.total ?? 0) || 0;
      logBoth("INFO", `[EvidenceTool] query=${label} rows=${Array.isArray(rows) ? rows.length : 0}`);
      return n;
    };

    const pickCreatedDateColumn = (cols: string[]): string | undefined => {
      return pickFirstColumn(cols, [
        "create_date",
        "created_at",
        "created_date",
        "created",
        "createdAt",
        "created_on",
        "timestamp",
        "update_date",
        "updated_at",
      ]);
    };

    try {
      const creds = assertDetectDbCreds();
      if (!creds.ok) {
        return {
          content: [{ type: "text" as const, text: `ERR:${creds.code} ${creds.message}` }],
          structuredContent: { ok: false, intent: action, code: creds.code, message: creds.message },
        };
      }

      // ===== Required v1 intents (counts only; parameterized) =====
      if (action === "active_machines_offline_count") {
        const n = await countQuery(
          "SELECT COUNT(*) as c FROM machines WHERE is_online = ?",
          [0],
          "active_machines_offline_count"
        );
        return {
          content: [{ type: "text" as const, text: `ตอนนี้เครื่องออฟไลน์: ${n} เครื่อง` }],
          structuredContent: { ok: true, intent: action, count: n },
        };
      }

      if (action === "active_machines_count") {
        const n = await countQuery(
          "SELECT COUNT(*) as c FROM machines WHERE is_online = ?",
          [1],
          "active_machines_count"
        );
        return {
          content: [{ type: "text" as const, text: `ตอนนี้เครื่องออนไลน์: ${n} เครื่อง` }],
          structuredContent: { ok: true, intent: action, count: n },
        };
      }

      if (action === "machines_evidence_active_today") {
        const today = getBangkokToday();
        const cols = await getColumns("machines");
        const dateCol = pickFirstColumn(cols, ["last_check_in", "create_datetime"]);
        const onlineCol = pickFirstColumn(cols, ["is_online", "online", "isOnline"]);
        if (!dateCol) {
          logBoth("WARN", `[EvidenceTool] query=machines_evidence_active_today missing_date_column cols=${cols.join(",")}`);
          return {
            content: [{ type: "text" as const, text: "ไม่พบคอลัมน์ last_check_in หรือ create_datetime ในตาราง machines" }],
            structuredContent: { ok: false, intent: action, code: "MISSING_DATE_COLUMN", table: "machines" },
          };
        }

        // ตามสเปค Phase 7.2.4: เลือก column ที่มีจริงใน DB (schema-detect) แล้วนับ DATE(column)=วันนี้
        const n = onlineCol
          ? await countQuery(
              `SELECT COUNT(*) as c FROM machines WHERE DATE(\`${dateCol}\`) = ? AND \`${onlineCol}\` = ?`,
              [today, 1],
              "machines_evidence_active_today"
            )
          : await countQuery(
              `SELECT COUNT(*) as c FROM machines WHERE DATE(\`${dateCol}\`) = ?`,
              [today],
              "machines_evidence_active_today"
            );
        return {
          content: [{ type: "text" as const, text: `วันนี้ machine evidence ทำงาน: ${n} เครื่อง` }],
          structuredContent: { ok: true, intent: action, count: n, dateColumn: dateCol, today },
        };
      }

      if (action === "evidence_records_today") {
        const cols = await getColumns("record");
        const createdCol = pickCreatedDateColumn(cols);
        if (!createdCol) {
          logBoth("WARN", `[EvidenceTool] query=evidence_records_today missing_created_date_column cols=${cols.join(",")}`);
          return {
            content: [{ type: "text" as const, text: "ไม่พบคอลัมน์วันที่สร้างในตาราง record" }],
            structuredContent: { ok: false, intent: action, code: "MISSING_DATE_COLUMN", table: "record" },
          };
        }

        const today = getBangkokToday();
        const n = await countQuery(
          `SELECT COUNT(*) as c FROM record WHERE DATE(\`${createdCol}\`) = ?`,
          [today],
          "evidence_records_today"
        );
        return {
          content: [{ type: "text" as const, text: `วันนี้จัดเก็บหลักฐานวิดีโอแล้ว: ${n} รายการ` }],
          structuredContent: { ok: true, intent: action, count: n, dateColumn: createdCol, today },
        };
      }

      if (action === "detected_urls_today") {
        const cols = await getColumns("nip");
        const createdCol = pickCreatedDateColumn(cols);
        if (!createdCol) {
          logBoth("WARN", `[EvidenceTool] query=detected_urls_today missing_created_date_column cols=${cols.join(",")}`);
          return {
            content: [{ type: "text" as const, text: "ไม่พบคอลัมน์วันที่สร้างในตาราง nip" }],
            structuredContent: { ok: false, intent: action, code: "MISSING_DATE_COLUMN", table: "nip" },
          };
        }

        const today = getBangkokToday();
        const n = await countQuery(
          `SELECT COUNT(*) as c FROM nip WHERE DATE(\`${createdCol}\`) = ?`,
          [today],
          "detected_urls_today"
        );
        return {
          content: [{ type: "text" as const, text: `วันนี้ตรวจพบ URL แล้ว: ${n} รายการ` }],
          structuredContent: { ok: true, intent: action, count: n, dateColumn: createdCol, today },
        };
      }

      if (action === "officer_summary") {
        const today = getBangkokToday();

        // --- machines ---
        const machineCols = await getColumns("machines");
        const machineOnlineCol = pickFirstColumn(machineCols, ["is_online", "online", "isOnline"]);
        const machineStatusCol = pickFirstColumn(machineCols, ["status", "monitor_status", "monitor", "state"]);
        const machineLastCheckCol = pickFirstColumn(machineCols, ["last_check_in", "last_checkin", "last_check", "last_seen", "updated_at", "update_date"]);

        let online_count: number | null = null;
        if (machineOnlineCol) {
          online_count = await countQuery(
            `SELECT COUNT(*) as c FROM machines WHERE \`${machineOnlineCol}\` = ?`,
            [1],
            "machines_online"
          );
        } else if (machineStatusCol) {
          online_count = await countQuery(
            `SELECT COUNT(*) as c FROM machines WHERE \`${machineStatusCol}\` IN (?, ?)`,
            ["online", "ONLINE"],
            "machines_online_status"
          );
        }

        let evidence_active_count: number | null = null;
        if (machineLastCheckCol && machineOnlineCol) {
          evidence_active_count = await countQuery(
            `SELECT COUNT(*) as c FROM machines WHERE DATE(\`${machineLastCheckCol}\`) = ? AND \`${machineOnlineCol}\` = ?`,
            [today, 1],
            "machines_evidence_active_today"
          );
        } else if (machineLastCheckCol && machineStatusCol) {
          evidence_active_count = await countQuery(
            `SELECT COUNT(*) as c FROM machines WHERE DATE(\`${machineLastCheckCol}\`) = ? AND \`${machineStatusCol}\` IN (?, ?)`,
            [today, "online", "ONLINE"],
            "machines_evidence_active_today_status"
          );
        }


        // --- record ---
        const recordCols = await getColumns("record");
        const recordCreatedCol = pickFirstColumn(recordCols, ["created_at", "create_date", "created_date", "created", "createdAt", "created_on", "timestamp"]);
        let records_created_today_count: number | null = null;
        if (recordCreatedCol) {
          records_created_today_count = await countQuery(
            `SELECT COUNT(*) as c FROM record WHERE DATE(\`${recordCreatedCol}\`) = ?`,
            [today],
            "records_created_today"
          );
        }

        // --- nip ---
        const nipCols = await getColumns("nip");
        const nipCreatedCol = pickFirstColumn(nipCols, ["created_at", "create_date", "created_date", "created", "createdAt", "created_on", "timestamp"]);
        const nipOpenCol = pickFirstColumn(nipCols, ["is_open", "open", "status"]);

        let nip_created_today_count: number | null = null;
        if (nipCreatedCol) {
          nip_created_today_count = await countQuery(
            `SELECT COUNT(*) as c FROM nip WHERE DATE(\`${nipCreatedCol}\`) = ?`,
            [today],
            "nip_created_today"
          );
        }

        let nip_open_count: number | null = null;
        if (nipOpenCol) {
          if (nipOpenCol.toLowerCase() === "status") {
            nip_open_count = await countQuery(
              `SELECT COUNT(*) as c FROM nip WHERE \`${nipOpenCol}\` IN (?, ?)`,
              ["open", "OPEN"],
              "nip_open_count"
            );
          } else {
            nip_open_count = await countQuery(
              `SELECT COUNT(*) as c FROM nip WHERE \`${nipOpenCol}\` = ?`,
              [1],
              "nip_open_count_flag"
            );
          }
        }

        const structuredContent: any = {
          ok: true,
          today,
          machines: {
            online_count,
            evidence_active_count,
          },
          records: {
            created_today_count: records_created_today_count,
          },
          nip: {
            created_today_count: nip_created_today_count,
            ...(nip_open_count !== null ? { open_count: nip_open_count } : {}),
          },
        };

        const lines: string[] = [];
        lines.push(`สรุปข้อมูลเจ้าหน้าที่ (วันที่ ${today})`);
        if (online_count !== null) lines.push(`- Machine online: ${online_count} เครื่อง`);
        else lines.push(`- Machine online: (ไม่พบคอลัมน์สถานะ online)`);

        if (evidence_active_count !== null) lines.push(`- วันนี้ machine evidence ทำงานอยู่: ${evidence_active_count} เครื่อง`);
        else lines.push(`- วันนี้ machine evidence ทำงานอยู่: (ไม่พบคอลัมน์ last_check_in/online ที่ใช้คำนวณ)`);

        if (records_created_today_count !== null) lines.push(`- วันนี้จัดเก็บหลักฐานวิดีโอได้ทั้งหมด: ${records_created_today_count} รายการ`);
        else lines.push(`- วันนี้จัดเก็บหลักฐานวิดีโอได้ทั้งหมด: (ไม่พบคอลัมน์วันที่สร้างในตาราง record)`);

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent,
        };
      }

      if (action === "list_tables") {
        const tables = await queryDetect("SHOW TABLES");
        const names = Array.isArray(tables)
          ? tables
              .map((r: any) => {
                if (r && typeof r === "object") {
                  const v = Object.values(r)[0];
                  return String(v || "").trim();
                }
                return "";
              })
              .filter(Boolean)
          : [];
        return {
          content: [
            { type: "text" as const, text: names.length > 0 ? names.join("\n") : "(no tables)" },
          ],
        };
      }

      if (action === "describe_table") {
        if (!tableName)
          throw new Error("tableName is required for describe_table");
        const columns = await queryDetect(`DESCRIBE \`${tableName}\``);
        const names = Array.isArray(columns)
          ? columns.map((r: any) => String(r?.Field || r?.field || "").trim()).filter(Boolean)
          : [];
        return {
          content: [
            { type: "text" as const, text: names.length > 0 ? names.join(",") : "(no columns)" },
          ],
        };
      }

      return { content: [{ type: "text" as const, text: "Invalid action" }] };
    } catch (error: any) {
      const code = String((error as any)?.code || "EVIDENCE_TOOL_FAILED");
      const message = String(error?.message || error);
      logBoth("ERROR", `[EvidenceTool] Error code=${code} message=${message}`);
      return {
        content: [{ type: "text" as const, text: `ERR:${code} ${message}` }],
        structuredContent: { ok: false, intent: action, code, message },
      };
    }
  },
};

export function registerEvidenceTool(server: McpServer) {
  server.registerTool(
    evidenceTool.name,
    {
      title: "Evidence Tool (Detect DB)",
      description: evidenceTool.description,
      inputSchema: evidenceTool.inputSchema,
    },
    evidenceTool.execute,
  );
}
