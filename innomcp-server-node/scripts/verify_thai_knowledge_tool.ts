import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { thaiKnowledgeTool } from "../src/mcp/tools/thaiKnowledgeTool";
import * as fs from "fs";

async function runVerification() {
  console.log("=== STARTING THAI KNOWLEDGE TOOL VERIFICATION ===");
  
  let exitCode = 0;
  try {
    // 1. Test searching with high confidence constraint
    console.log("\\n[Test 1] Searching for 'กรุงเทพ' (Confidence > 0.8)");
    const res1 = await thaiKnowledgeTool.execute({
      query: "กรุงเทพ",
      context: { confidence_required: 0.8 }
    });
    console.log(JSON.stringify(res1, null, 2));
    
    // 2. Test searching for non-existent with high confidence constraint
    console.log("\\n[Test 2] Searching for 'เมืองลับแล' (Should fail LOW_CONFIDENCE or NOT_FOUND)");
    const res2 = await thaiKnowledgeTool.execute({
      query: "เมืองลับแล",
      context: { confidence_required: 0.9 }
    });
    console.log(JSON.stringify(res2, null, 2));

    // 3. Test filtering by domain
    console.log("\\n[Test 3] Searching by domain 'geo'");
    const res3 = await thaiKnowledgeTool.execute({
      query: "เชียงใหม่",
      context: { domain: "geo" }
    });
    console.log(JSON.stringify(res3, null, 2));

    console.log("\\n=== VERIFICATION COMPLETE ===");
  } catch (error) {
    console.error("Verification failed with exception:", error);
    exitCode = 1;
  }
  
  process.exit(exitCode);
}

runVerification();
