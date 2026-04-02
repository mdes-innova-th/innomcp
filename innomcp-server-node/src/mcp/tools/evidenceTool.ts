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

    type EvidenceDataSource = "detectdb" | "placeholder";
    const PLACEHOLDER_NOTE =
      "หมายเหตุ: ข้อมูลชุดนี้เป็นค่าตัวอย่าง (placeholder) เนื่องจากระบบฐานข้อมูลหลักฐานยังไม่พร้อมใช้งานครับ";
    const metaFor = (dataSource: EvidenceDataSource, note?: string) => {
      const meta: any = { dataSource };
      if (dataSource === "placeholder") meta.note = String(note || PLACEHOLDER_NOTE);
      return meta;
    };

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
          content: [
            {
              type: "text" as const,
              text: "ขออภัย ขณะนี้ยังไม่พร้อมเชื่อมต่อฐานข้อมูลหลักฐาน กรุณาติดต่อผู้ดูแลระบบหรือลองใหม่ภายหลังครับ",
            },
          ],
          structuredContent: {
            ok: false,
            intent: action,
            code: creds.code,
            message: creds.message,
            meta: metaFor("placeholder"),
          },
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
          structuredContent: { ok: true, intent: action, count: n, meta: metaFor("detectdb") },
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
          structuredContent: { ok: true, intent: action, count: n, meta: metaFor("detectdb") },
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
            structuredContent: {
              ok: false,
              intent: action,
              code: "MISSING_DATE_COLUMN",
              table: "machines",
              meta: metaFor("placeholder"),
            },
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
          structuredContent: { ok: true, intent: action, count: n, dateColumn: dateCol, today, meta: metaFor("detectdb") },
        };
      }

      if (action === "evidence_records_today") {
        const cols = await getColumns("record");
        const createdCol = pickCreatedDateColumn(cols);
        if (!createdCol) {
          logBoth("WARN", `[EvidenceTool] query=evidence_records_today missing_created_date_column cols=${cols.join(",")}`);
          return {
            content: [{ type: "text" as const, text: "ไม่พบคอลัมน์วันที่สร้างในตาราง record" }],
            structuredContent: { ok: false, intent: action, code: "MISSING_DATE_COLUMN", table: "record", meta: metaFor("placeholder") },
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
          structuredContent: { ok: true, intent: action, count: n, dateColumn: createdCol, today, meta: metaFor("detectdb") },
        };
      }

      if (action === "detected_urls_today") {
        const cols = await getColumns("nip");
        const createdCol = pickCreatedDateColumn(cols);
        if (!createdCol) {
          logBoth("WARN", `[EvidenceTool] query=detected_urls_today missing_created_date_column cols=${cols.join(",")}`);
          return {
            content: [{ type: "text" as const, text: "ไม่พบคอลัมน์วันที่สร้างในตาราง nip" }],
            structuredContent: { ok: false, intent: action, code: "MISSING_DATE_COLUMN", table: "nip", meta: metaFor("placeholder") },
          };
        }

        const today = getBangkokToday();
        const ispFilter = args.ispFilter ? String(args.ispFilter).trim() : null;
        let sql = `SELECT COUNT(*) as c FROM nip WHERE DATE(\`${createdCol}\`) = ?`;
        const params: any[] = [today];
        if (ispFilter) {
          const ispCol = pickFirstColumn(cols, ["isp", "isp_name", "ispName", "provider", "provider_name", "operator", "operator_name"]);
          if (ispCol) {
            sql += ` AND LOWER(\`${ispCol}\`) = LOWER(?)`;
            params.push(ispFilter);
          }
        }
        const n = await countQuery(sql, params, "detected_urls_today");
        const label = ispFilter
          ? `วันนี้ตรวจพบ URL จาก ${ispFilter.toUpperCase()} แล้ว: ${n} รายการ`
          : `วันนี้ตรวจพบ URL แล้ว: ${n} รายการ`;
        return {
          content: [{ type: "text" as const, text: label }],
          structuredContent: { ok: true, intent: action, count: n, ispFilter: ispFilter || undefined, dateColumn: createdCol, today, meta: metaFor("detectdb") },
        };
      }

      // Phase 7.3: เมื่อวาน evidence ได้เท่าไหร่
      if (action === "evidence_records_yesterday_total") {
        const cols = await getColumns("record");
        const createdCol = pickCreatedDateColumn(cols);
        if (!createdCol) {
          return {
            content: [{ type: "text" as const, text: "ไม่พบคอลัมน์วันที่สร้างในตาราง record" }],
            structuredContent: { ok: false, intent: action, code: "MISSING_DATE_COLUMN", table: "record", meta: metaFor("placeholder") },
          };
        }
        const yesterday = (() => {
          const now = new Date();
          const bkkMs = now.getTime() + 7 * 60 * 60 * 1000;
          const bkk = new Date(bkkMs);
          bkk.setUTCDate(bkk.getUTCDate() - 1);
          return `${bkk.getUTCFullYear()}-${String(bkk.getUTCMonth() + 1).padStart(2, "0")}-${String(bkk.getUTCDate()).padStart(2, "0")}`;
        })();
        const n = await countQuery(
          `SELECT COUNT(*) as c FROM record WHERE DATE(\`${createdCol}\`) = ?`,
          [yesterday],
          "evidence_records_yesterday_total"
        );
        return {
          content: [{ type: "text" as const, text: `เมื่อวานนี้จัดเก็บหลักฐานวิดีโอได้: ${n} รายการ` }],
          structuredContent: { ok: true, intent: action, count: n, date: yesterday, dateColumn: createdCol, meta: metaFor("detectdb") },
        };
      }

      // Phase 7.3: เมื่อวาน evidence แยกตาม ISP + ใครมากสุด
      if (action === "evidence_records_yesterday_by_isp_top") {
        const recordCols = await getColumns("record");
        const nipCols = await getColumns("nip");
        const createdCol = pickCreatedDateColumn(recordCols);
        const recordNipCol = pickFirstColumn(recordCols, ["nip_no", "nipNo", "nip_id", "nipId", "nip", "id_nip"]);
        const nipNoCol = pickFirstColumn(nipCols, ["no", "nip_no", "nipNo", "nip_id", "id"]);
        const ispCol = pickFirstColumn(nipCols, ["isp", "isp_name", "ispName", "provider", "provider_name", "operator", "operator_name"]);

        const yesterday = (() => {
          const now = new Date();
          const bkkMs = now.getTime() + 7 * 60 * 60 * 1000;
          const bkk = new Date(bkkMs);
          bkk.setUTCDate(bkk.getUTCDate() - 1);
          return `${bkk.getUTCFullYear()}-${String(bkk.getUTCMonth() + 1).padStart(2, "0")}-${String(bkk.getUTCDate()).padStart(2, "0")}`;
        })();

        if (!createdCol) {
          return {
            content: [{ type: "text" as const, text: "ไม่พบคอลัมน์วันที่สร้างในตาราง record" }],
            structuredContent: { ok: false, intent: action, code: "MISSING_DATE_COLUMN", dbTable: "record", meta: metaFor("placeholder"), table: { rows: [] } },
          };
        }

        const total = await countQuery(`SELECT COUNT(*) as c FROM record WHERE DATE(\`${createdCol}\`) = ?`, [yesterday], "yesterday_total");

        if (!recordNipCol || !nipNoCol || !ispCol) {
          return {
            content: [{ type: "text" as const, text: `เมื่อวานนี้รวม ${total} รายการ (ไม่สามารถแยกตาม ISP ได้)` }],
            structuredContent: { ok: true, intent: action, date: yesterday, total, meta: metaFor("detectdb"), table: { rows: [] } },
          };
        }

        const rows = await queryDetect<any>(
          `SELECT n.\`${ispCol}\` as isp, COUNT(*) as c FROM record r JOIN nip n ON r.\`${recordNipCol}\` = n.\`${nipNoCol}\` WHERE DATE(r.\`${createdCol}\`) = ? GROUP BY n.\`${ispCol}\` ORDER BY c DESC LIMIT 3`,
          [yesterday]
        );

        const byIsp = Array.isArray(rows) ? rows.map((r: any) => ({ isp: String(r.isp ?? "(ไม่ระบุ)").trim() || "(ไม่ระบุ)", count: Number(r.c || 0) || 0 })) : [];
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
          content: [{ type: "text" as const, text: top ? `เมื่อวานนี้รวม ${total} รายการ | ISP มากสุด: ${top.isp} (${top.count})` : `เมื่อวานนี้รวม ${total} รายการ` }],
          structuredContent: { ok: true, intent: action, date: yesterday, total, byIsp: tableRows, topIsp: top, meta: metaFor("detectdb"), table: { rows: tableRows } },
        };
      }

      // Phase 7.3: trend 7 วันของหลักฐาน
      if (action === "evidence_records_last_7_days_trend") {
        const cols = await getColumns("record");
        const createdCol = pickCreatedDateColumn(cols);
        if (!createdCol) {
          return {
            content: [{ type: "text" as const, text: "ไม่พบคอลัมน์วันที่สร้างในตาราง record" }],
            structuredContent: { ok: false, intent: action, code: "MISSING_DATE_COLUMN", table: "record", meta: metaFor("placeholder") },
          };
        }

        const getBkkDate = (offsetDays: number): string => {
          const now = new Date();
          const bkkMs = now.getTime() + 7 * 60 * 60 * 1000;
          const bkk = new Date(bkkMs);
          bkk.setUTCDate(bkk.getUTCDate() + offsetDays);
          return `${bkk.getUTCFullYear()}-${String(bkk.getUTCMonth() + 1).padStart(2, "0")}-${String(bkk.getUTCDate()).padStart(2, "0")}`;
        };

        const end = getBkkDate(0);
        const start = getBkkDate(-6);
        const rows = await queryDetect<any>(
          `SELECT DATE_FORMAT(\`${createdCol}\`, '%Y-%m-%d') as d, COUNT(*) as c FROM record WHERE DATE(\`${createdCol}\`) BETWEEN ? AND ? GROUP BY d ORDER BY d ASC`,
          [start, end]
        );

        const byDate = new Map<string, number>();
        if (Array.isArray(rows)) {
          for (const r of rows) {
            const d = String(r?.d ?? "").slice(0, 10);
            if (/^\d{4}-\d{2}-\d{2}$/.test(d)) byDate.set(d, Number(r?.c || 0));
          }
        }

        const points = Array.from({ length: 7 }).map((_, idx) => {
          const d = getBkkDate(-6 + idx);
          return { date: d, count: byDate.get(d) ?? 0 };
        });
        const total = points.reduce((s, p) => s + p.count, 0);

        const lines = points.map((p) => `${p.date}: ${p.count}`);
        return {
          content: [{ type: "text" as const, text: `แนวโน้มหลักฐาน 7 วันล่าสุด:\n${lines.join("\n")}\nรวม 7 วัน: ${total} รายการ` }],
          structuredContent: { ok: true, intent: action, range: { start, end }, series: { label: "หลักฐานต่อวัน", points }, total, meta: metaFor("detectdb") },
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
          meta: metaFor("detectdb"),
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

      if (action === "nip_top_isp_this_month") {
        const nipCols = await getColumns("nip");
        const ispCol = pickFirstColumn(nipCols, ["isp", "isp_name", "ispName", "provider", "provider_name", "operator", "operator_name"]) || "isp_name";
        const rows = await queryDetect<any>(
          `SELECT \`${ispCol}\`, COUNT(*) as c FROM nip WHERE YEAR(create_date)=YEAR(NOW()) AND MONTH(create_date)=MONTH(NOW()) GROUP BY \`${ispCol}\` ORDER BY c DESC LIMIT 10`
        );
        const byIsp = Array.isArray(rows) ? rows.map((r:any) => ({ isp: String(r[ispCol]||"(ไม่ระบุ)").trim()||"(ไม่ระบุ)", count: Number(r.c||0) })) : [];
        const top = byIsp[0] || null;
        const totalSum = byIsp.reduce((s: number, r: any) => s + (Number(r.count) || 0), 0);
        const monthLabel = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`; })();
        return {
          content: [{ type: "text" as const, text: top ? `เดือนนี้ (${monthLabel}) ISP มากสุด: ${top.isp} (${top.count} รายการ)` : `เดือนนี้ยังไม่มีข้อมูล` }],
          structuredContent: { ok: true, intent: action, month: monthLabel, byIsp, topIsp: top, kpis: { total: totalSum, topIspName: top?.isp ?? null, topIspCount: top?.count ?? null }, table: { rows: byIsp }, meta: metaFor("detectdb") },
        };
      }

      if (action === "nip_top_isp_all") {
        const safeL = Math.min(Math.max(1, safeLimit), 10);
        const nipCols2 = await getColumns("nip");
        const ispCol2 = pickFirstColumn(nipCols2, ["isp", "isp_name", "ispName", "provider", "provider_name", "operator", "operator_name"]) || "isp_name";
        const rows = await queryDetect<any>(
          `SELECT \`${ispCol2}\`, COUNT(*) as c FROM nip GROUP BY \`${ispCol2}\` ORDER BY c DESC LIMIT ${safeL}`
        );
        const byIsp = Array.isArray(rows) ? rows.map((r:any) => ({ isp: String(r[ispCol2]||"(ไม่ระบุ)").trim()||"(ไม่ระบุ)", count: Number(r.c||0) })) : [];
        const top = byIsp[0] || null;
        const totalSum = byIsp.reduce((s: number, r: any) => s + (Number(r.count) || 0), 0);
        return {
          content: [{ type: "text" as const, text: top ? `Top ISP ทั้งหมด: ${top.isp} (${top.count} รายการ)` : "ยังไม่มีข้อมูล" }],
          structuredContent: { ok: true, intent: action, topN: safeL, byIsp, topIsp: top, kpis: { total: totalSum, topIspName: top?.isp ?? null, topIspCount: top?.count ?? null }, table: { rows: byIsp }, meta: metaFor("detectdb") },
        };
      }

      if (action === "machine_last_scan") {
        const machCols = await getColumns("machines");
        const machIspCol = pickFirstColumn(machCols, ["isp", "isp_name", "ispName", "provider", "provider_name", "operator", "operator_name"]) || "isp_name";
        const machDateCol = pickFirstColumn(machCols, ["last_check_in", "last_checkin", "last_check", "last_seen", "updated_at", "update_date"]) || "last_check_in";
        const machOnlineCol = pickFirstColumn(machCols, ["is_online", "online", "isOnline"]) || "is_online";
        const rows = await queryDetect<any>(
          `SELECT pc_name, \`${machIspCol}\` as isp_name, ip_address, \`${machDateCol}\` as last_check_in, \`${machOnlineCol}\` as is_online FROM machines ORDER BY \`${machDateCol}\` DESC LIMIT 5`
        );
        const machines = Array.isArray(rows) ? rows.map((r:any) => ({
          pc_name: String(r.pc_name||"(ไม่ระบุ)"),
          isp_name: String(r.isp_name||"(ไม่ระบุ)"),
          ip_address: String(r.ip_address||""),
          last_check_in: r.last_check_in ? new Date(r.last_check_in).toISOString() : null,
          is_online: Number(r.is_online||0) === 1,
        })) : [];
        const latest = machines[0] || null;
        const latestText = latest ? `เครื่องสแกนล่าสุด: ${latest.pc_name} (${latest.isp_name}) ตรวจสอบล่าสุด ${latest.last_check_in?.slice(0,16)||"-"}` : "ไม่พบข้อมูล";
        return {
          content: [{ type: "text" as const, text: latestText }],
          structuredContent: { ok: true, intent: action, machines, latest, meta: metaFor("detectdb") },
        };
      }

      if (action === "nip_latest") {
        const safeL = Math.min(Math.max(1, safeLimit), 10);
        const nipCols3 = await getColumns("nip");
        const nipIspCol = pickFirstColumn(nipCols3, ["isp", "isp_name", "ispName", "provider", "provider_name", "operator", "operator_name"]) || "isp_name";
        const nipNoCol = pickFirstColumn(nipCols3, ["no", "nip_no", "nipNo", "nip_id", "id"]) || "no";
        const rows = await queryDetect<any>(
          `SELECT \`${nipNoCol}\` as no, url, \`${nipIspCol}\` as isp_name, create_date FROM nip ORDER BY create_date DESC LIMIT ${safeL}`
        );
        const items = Array.isArray(rows) ? rows.map((r:any) => ({
          no: Number(r.no||0),
          url: String(r.url||""),
          isp_name: String(r.isp_name||""),
          create_date: r.create_date ? new Date(r.create_date).toISOString() : null,
        })) : [];
        const latest = items[0] || null;
        const latestText = latest ? `URL ผิดกฎหมายล่าสุด: ${latest.url} (${latest.isp_name}) เมื่อ ${latest.create_date?.slice(0,10)||"-"}` : "ไม่พบข้อมูล";
        return {
          content: [{ type: "text" as const, text: latestText }],
          structuredContent: { ok: true, intent: action, items, latest, meta: metaFor("detectdb") },
        };
      }

      if (action === "nip_by_record_top") {
        const safeL = Math.min(Math.max(1, safeLimit), 10);
        const rows = await queryDetect<any>(
          `SELECT nip_no, COUNT(*) as c FROM record GROUP BY nip_no ORDER BY c DESC LIMIT ${safeL}`
        );
        const items = Array.isArray(rows) ? rows.map((r:any) => ({ nip_no: Number(r.nip_no||0), count: Number(r.c||0) })) : [];
        const top = items[0] || null;
        const topText = top ? `NIP ที่มี record มากสุด: nip_no=${top.nip_no} (${top.count} รายการ)` : "ไม่พบข้อมูล";
        return {
          content: [{ type: "text" as const, text: topText }],
          structuredContent: { ok: true, intent: action, items, top, meta: metaFor("detectdb") },
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
          structuredContent: { ok: true, intent: action, meta: metaFor("detectdb"), tables: names },
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
          structuredContent: { ok: true, intent: action, meta: metaFor("detectdb"), table: tableName, columns: names },
        };
      }

      return { content: [{ type: "text" as const, text: "Invalid action" }] };
    } catch (error: any) {
      const code = String((error as any)?.code || "EVIDENCE_TOOL_FAILED");
      const message = String(error?.message || error);
      logBoth("ERROR", `[EvidenceTool] Error code=${code}`);
      return {
        content: [
          {
            type: "text" as const,
            text: "ขออภัย ระบบสืบค้นฐานข้อมูลหลักฐานขัดข้อง กรุณาลองใหม่อีกครั้งครับ",
          },
        ],
        structuredContent: { ok: false, intent: action, code, message, meta: metaFor("placeholder") },
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
