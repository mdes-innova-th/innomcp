import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { query } from "../../utils/db";

export const keywordTool = {
  name: "keywordTool",
  description: "Manage keywords for AI training/recognition.",
  inputSchema: z.object({
    action: z.enum(["add", "list"]),
    keyword: z.string().optional(),
    category: z.string().optional(),
  }),
  execute: async (args: any) => {
    const { action, keyword, category } = args;

    try {
      if (action === "add") {
        if (!keyword || !category)
          throw new Error("Keyword and Category required for add");
        await query(
          "INSERT INTO keyword_training (keyword, category) VALUES (?, ?) ON DUPLICATE KEY UPDATE hit_count = hit_count + 1",
          [keyword, category],
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Added/Updated keyword: ${keyword}`,
            },
          ],
        };
      }

      if (action === "list") {
        const rows = await query("SELECT * FROM keyword_training LIMIT 50");
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(rows, null, 2) },
          ],
        };
      }

      return { content: [{ type: "text" as const, text: "Invalid action" }] };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err.message}` }],
      };
    }
  },
};

export function registerKeywordTool(server: McpServer) {
  server.registerTool(
    keywordTool.name,
    {
      title: "Keyword Tool",
      description: keywordTool.description,
      inputSchema: keywordTool.inputSchema,
    },
    keywordTool.execute,
  );
}
