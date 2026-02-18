import "dotenv/config";

import { evidenceTool } from "../src/mcp/tools/evidenceTool";

async function main() {
  const startedAt = new Date();
  console.log(`[Phase7.2] verify officer EvidenceTool v1 startedAt=${startedAt.toISOString()}`);

  const result = await evidenceTool.execute({ action: "officer_summary" });

  const text = Array.isArray((result as any)?.content)
    ? (result as any).content.map((c: any) => c?.text).filter(Boolean).join("\n")
    : "";

  console.log("\n--- TEXT ---\n" + text);
  console.log("\n--- STRUCTURED ---\n" + JSON.stringify((result as any)?.structuredContent ?? null, null, 2));

  const ok = Boolean((result as any)?.structuredContent?.ok);
  console.log(`\n[Phase7.2] ok=${ok}`);

  process.exit(ok ? 0 : 2);
}

main().catch((err) => {
  console.error("[Phase7.2] ERROR", err);
  process.exit(1);
});
