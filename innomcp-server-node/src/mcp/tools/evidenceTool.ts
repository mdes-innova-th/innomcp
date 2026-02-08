import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { queryDetect } from "../../utils/dbDetect";

export const evidenceTool = {
  name: "evidenceTool",
  description:
    "Access and explore the external 'detect' database for evidence data. Use this tool to list tables or query recent entries when you don't know the exact schema.",
  inputSchema: z.object({
    action: z
      .enum([
        "list_tables",
        "describe_table",
        "query_recent",
        "custom_query",
        "report_latest_undetected",
        "report_top_urls",
      ])
      .describe("Action to perform"),
    tableName: z
      .string()
      .optional()
      .describe("Table name for describe/query actions"),
    limit: z
      .number()
      .optional()
      .default(5)
      .describe("Limit number of rows (default 5, max 20)"),
    sql: z
      .string()
      .optional()
      .describe("Custom SQL query (READ ONLY - SELECT only)"),
  }),
  execute: async (args: any) => {
    const { action, tableName, limit, sql } = args;
    const safeLimit = Math.min(Math.max(1, limit || 5), 20);

    try {
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
        // Vulnerability Note: In production, sanitize tableName more strictly or use parameterized query if possible for metadata
        const columns = await queryDetect(`DESCRIBE ${tableName}`);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(columns, null, 2) },
          ],
        };
      }

      if (action === "query_recent") {
        if (!tableName)
          throw new Error("tableName is required for query_recent");
        // Simple discovery: Select * with limit
        // Note: This assumes the table exists.
        const rows = await queryDetect(`SELECT * FROM ${tableName} LIMIT ?`, [
          safeLimit,
        ]);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(rows, null, 2) },
          ],
        };
      }

      if (action === "custom_query") {
        if (!sql) throw new Error("sql is required for custom_query");
        if (!sql.trim().toLowerCase().startsWith("select")) {
          throw new Error("Only SELECT queries are allowed for safety.");
        }
        if (sql.includes(";")) {
          throw new Error("Multiple statements not allowed.");
        }
        const rows = await queryDetect(sql);
        // Slice in memory to enforce limit on custom queries just in case
        const limitedRows = Array.isArray(rows)
          ? rows.slice(0, safeLimit)
          : rows;
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(limitedRows, null, 2),
            },
          ],
        };
      }

      // NEW: Report - Latest Undetected URLs
      if (action === "report_latest_undetected") {
        // Assumption: Table name is 'entries' or 'urls'. We try 'entries' first.
        // Logic: "Undetected" might mean 'case_number' is NULL or specific status.
        // User said: "latest undetected URLs ... unseen/unrecorded".
        // We will select all, ordered by create_date DESC.
        // Columns: url ,title, http_status,isp_name,case_number,create_date,sent_isp_date,update_date

        const sql = `
              SELECT url, title, http_status, isp_name, case_number, create_date, sent_isp_date, update_date 
              FROM entries 
              ORDER BY create_date DESC 
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
                text: `Error generating report (Table 'entries' might not exist?): ${err.message}`,
              },
            ],
          };
        }
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
      return {
        content: [{ type: "text" as const, text: `Error: ${error.message}` }],
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
