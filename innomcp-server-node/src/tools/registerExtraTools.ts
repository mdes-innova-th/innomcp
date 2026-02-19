// innomcp-server-node/src/tools/registerExtraTools.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// NOTE: คุณต้องคัดลอกไฟล์ tools จาก docs/ADDON_CODE มาที่นี่:
// - imageGenTool.ts
// - connectorsTools.ts  
// - webSearchAggregatorTool.ts

// จากนั้น uncomment บรรทัดด้านล่าง:
// import { registerImageGenTool } from "./imageGenTool";
// import { registerConnectorsTools } from "./connectorsTools";
// import { registerWebSearchAggregatorTool } from "./webSearchAggregatorTool";

/**
 * Register all extra tools with MCP server
 * เรียกในไฟล์ init MCP server ของคุณ หลังสร้าง McpServer แล้ว
 * ตัวอย่าง:
 *   const server = new McpServer({...})
 *   registerExtraTools(server)
 */
export function registerExtraTools(server: McpServer) {
  console.log("⚠️  TODO: Copy tool files from docs/ADDON_CODE to this directory");
  console.log("Then uncomment the imports and function calls below");
  
  // registerImageGenTool(server);
  // registerConnectorsTools(server);
  // registerWebSearchAggregatorTool(server);
}
