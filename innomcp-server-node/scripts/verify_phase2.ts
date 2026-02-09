import "dotenv/config";
import assert from "node:assert/strict";
import { query } from "../src/utils/db";
import { thaiHistoryTool } from "../src/mcp/tools/thaiHistoryTool";
import { thaiLawTool } from "../src/mcp/tools/thaiLawTool";

function parseToolText(result: any): any {
  assert.ok(result);
  assert.ok(Array.isArray(result.content));
  assert.equal(result.content[0]?.type, "text");
  return JSON.parse(result.content[0].text);
}

async function main(): Promise<void> {
  console.log("🔎 verify_phase2: start");

  const counts = await query<any[]>(
    "SELECT domain, COUNT(*) as cnt FROM knowledge_entities WHERE domain IN ('history','law') GROUP BY domain",
  );
  console.log("DB counts:", counts);

  const countMap = new Map<string, number>();
  for (const row of Array.isArray(counts) ? counts : []) {
    countMap.set(String(row.domain), Number(row.cnt));
  }

  assert.ok((countMap.get("history") ?? 0) >= 1, "DB should have >= 1 history entity");
  assert.ok((countMap.get("law") ?? 0) >= 1, "DB should have >= 1 law entity");

  const historyRes = await thaiHistoryTool.execute({ query: "สุโขทัย" });
  const historyBody = parseToolText(historyRes);
  console.log("historyBody:", historyBody);
  assert.equal(historyBody.domain, "history");
  assert.equal(historyBody.success, true);
  assert.ok(Array.isArray(historyBody.data));
  assert.ok(historyBody.data.length >= 1);

  const lawRes = await thaiLawTool.execute({ query: "PDPA" });
  const lawBody = parseToolText(lawRes);
  console.log("lawBody:", lawBody);
  assert.equal(lawBody.domain, "law");
  assert.equal(lawBody.success, true);
  assert.ok(Array.isArray(lawBody.data));
  assert.ok(lawBody.data.length >= 1);

  // Proof: sources should match seed
  assert.ok(Array.isArray(historyBody.source));
  assert.ok(Array.isArray(lawBody.source));
  assert.ok(
    historyBody.source.includes("Royal Thai Government Gazette"),
    "history source should include RTGG",
  );
  assert.ok(
    lawBody.source.includes("Royal Thai Government Gazette"),
    "law source should include RTGG",
  );

  console.log("✅ verify_phase2: PASS");
}

main().catch((err) => {
  console.error("❌ verify_phase2: FAIL", err);
  process.exitCode = 1;
});
