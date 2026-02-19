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
      // ===== Required v1 intents (counts only; parameterized) =====
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

      if (action === "evidence_records_today") {
        const cols = await getColumns("record");
        const createdCol = pickCreatedDateColumn(cols);
        if (!createdCol) {
          logBoth("WARN", `[EvidenceTool] query=evidence_records_today missing_created_date_column`);
          return {
            content: [{ type: "text" as const, text: "ไม่พบคอลัมน์วันที่สร้างในตาราง record" }],
            structuredContent: { ok: false, intent: action, code: "MISSING_DATE_COLUMN", table: "record" },
          };
        }

        const n = await countQuery(
          `SELECT COUNT(*) as c FROM record WHERE DATE(\`${createdCol}\`) = CURDATE()`,
          [],
          "evidence_records_today"
        );
        return {
          content: [{ type: "text" as const, text: `วันนี้จัดเก็บหลักฐานวิดีโอแล้ว: ${n} รายการ` }],
          structuredContent: { ok: true, intent: action, count: n },
        };
      }

      if (action === "detected_urls_today") {
        const cols = await getColumns("nip");
        const createdCol = pickCreatedDateColumn(cols);
        if (!createdCol) {
          logBoth("WARN", `[EvidenceTool] query=detected_urls_today missing_created_date_column`);
          return {
            content: [{ type: "text" as const, text: "ไม่พบคอลัมน์วันที่สร้างในตาราง nip" }],
            structuredContent: { ok: false, intent: action, code: "MISSING_DATE_COLUMN", table: "nip" },
          };
        }

        const n = await countQuery(
          `SELECT COUNT(*) as c FROM nip WHERE DATE(\`${createdCol}\`) = CURDATE()`,
          [],
          "detected_urls_today"
        );
        return {
          content: [{ type: "text" as const, text: `วันนี้ตรวจพบ URL แล้ว: ${n} รายการ` }],
          structuredContent: { ok: true, intent: action, count: n },
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

        let last_check_sample: any = undefined;
        if (machineLastCheckCol) {
          const rows = await queryDetect<any>(
            `SELECT \`${machineLastCheckCol}\` as last_check_sample FROM machines ORDER BY \`${machineLastCheckCol}\` DESC LIMIT 1`
          );
          last_check_sample = rows?.[0]?.last_check_sample;
          logBoth("INFO", `[EvidenceTool] query=machines_last_check_sample rows=${Array.isArray(rows) ? rows.length : 0}`);
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
            ...(last_check_sample !== undefined ? { last_check_sample } : {}),
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
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(tables, null, 2) },
          ],
        };
      }

      if (action === "describe_table") {
        if (!tableName)
          throw new Error("tableName is required for describe_table");
        const columns = await queryDetect(`DESCRIBE \`${tableName}\``);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(columns, null, 2) },
          ],
        };
      }

      // NEW: Report - Top URLs
      if (action === "report_top_urls") {
        // Logic: Top 10 frequent URLs, count total, and count video records.
        // Assumption: video record column is 'video_path' or 'video_status'. We will guess 'video_path' IS NOT NULL.
        // If column doesn't exist, this will fail. We need schema awareness.
        // For now, we perform a simpler GROUP BY first.

        const sql = `
              SELECT url, COUNT(*) as frequency, 
              SUM(CASE WHEN video_path IS NOT NULL AND video_path != '' THEN 1 ELSE 0 END) as video_record_count
              FROM entries 
              GROUP BY url 
              ORDER BY frequency DESC 
              LIMIT ?
          `;
        try {
          const rows = await queryDetect(sql, [safeLimit]);
          return {
            content: [
              { type: "text" as const, text: JSON.stringify(rows, null, 2) },
            ],
          };
        } catch (err: any) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error generating report: ${err.message}`,
              },
            ],
          };
        }
      }

      return { content: [{ type: "text" as const, text: "Invalid action" }] };
    } catch (error: any) {
      logBoth("ERROR", `[EvidenceTool] Error: ${String(error?.message || error)}`);
      return {
        content: [{ type: "text" as const, text: `Error: ${error.message}` }],
        structuredContent: { ok: false, error: String(error?.message || error) },
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
