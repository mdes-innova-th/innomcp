import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const STORAGE_ROOT = path.resolve(process.cwd(), "..", "workspace-storage");

// Ensure storage directory exists
(async () => {
  try {
    await fs.mkdir(STORAGE_ROOT, { recursive: true });
  } catch (err) {
    console.error("Failed to create storage directory:", err);
  }
})();

function getSafePath(filename: string): string {
  const safeName = path.basename(filename);
  return path.join(STORAGE_ROOT, safeName);
}

export const storageTool = {
  name: "storageTool",
  description:
    "Read and write files to a sandboxed storage directory (workspace-storage). Operations are limited to this directory for safety.",
  inputSchema: z.object({
    operation: z
      .enum(["write", "read", "list"])
      .describe("Operation to perform"),
    filename: z.string().optional().describe("Filename (for read/write ops)"),
    content: z.string().optional().describe("Content to write (for write op)"),
  }),
  execute: async (args: any) => {
    const { operation, filename, content } = args;

    try {
      if (operation === "list") {
        const files = await fs.readdir(STORAGE_ROOT);
        return {
          content: [
            {
              type: "text" as const,
              text: `Files in storage:\n${files.join("\n")}`,
            },
          ],
        };
      }

      if (!filename) {
        throw new Error("Filename is required for read/write operations");
      }

      const filePath = getSafePath(filename);

      if (operation === "write") {
        if (content === undefined)
          throw new Error("Content is required for write operation");
        await fs.writeFile(filePath, content, "utf-8");
        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully wrote to ${filename}`,
            },
          ],
        };
      }

      if (operation === "read") {
        const data = await fs.readFile(filePath, "utf-8");
        return {
          content: [{ type: "text" as const, text: data }],
        };
      }

      return {
        content: [{ type: "text" as const, text: "Invalid operation" }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${error.message}` }],
      };
    }
  },
};

export function registerStorageTool(server: McpServer) {
  server.registerTool(
    storageTool.name,
    {
      title: "Storage Tool",
      description: storageTool.description,
      inputSchema: storageTool.inputSchema,
    },
    storageTool.execute,
  );
}
