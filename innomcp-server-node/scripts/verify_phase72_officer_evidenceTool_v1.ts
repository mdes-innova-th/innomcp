import "dotenv/config";

import { evidenceTool } from "../src/mcp/tools/evidenceTool";

async function main() {
  const startedAt = new Date();
  console.log(`[Phase7.2] verify officer EvidenceTool v1 startedAt=${startedAt.toISOString()}`);

    const cases: Array<{ question: string; action: any }> = [
      { question: "ตอนนี้เครื่องออนไลน์กี่เครื่อง", action: "active_machines_count" },
      { question: "วันนี้จัดเก็บหลักฐานวิดีโอแล้วได้ทั้งหมดเท่าไหร่", action: "evidence_records_today" },
      { question: "วันนี้ตรวจพบ URL แล้วกี่รายการ", action: "detected_urls_today" },
    ];

    const results: any[] = [];

    for (const c of cases) {
      console.log(`\n[Q] ${c.question}`);
      const r = await evidenceTool.execute({ action: c.action });
      const text = r?.content?.[0]?.text ?? "";
      const structured = r?.structuredContent;
      results.push({ question: c.question, action: c.action, structured });

      console.log("--- TEXT ---");
      console.log(text);
      console.log("--- STRUCTURED ---");
      console.log(JSON.stringify(structured, null, 2));
    }

    const allOk = results.every((r) => r?.structured?.ok === true);
    console.log(`\n[Phase7.2] allOk=${allOk}`);
    process.exit(allOk ? 0 : 2);
}

main().catch((err) => {
  console.error("[Phase7.2] ERROR", err);
  process.exit(1);
});
