/**
 * Direct MDES dispatch test — bypasses the running backend.
 * Imports conductor + parallelDispatch from source and runs queries.
 *
 * Usage: cd innomcp-node && npx ts-node scripts/test-mdes-direct.ts
 */
import { runConductor } from "../src/agents/conductor";
import type { AgentEvent } from "../src/agents/events";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: ".env" });

const QUERIES: Array<{ id: string; q: string }> = [
  { id: "T1",  q: "ค้นหาหลักฐานคดีล่าสุดในระบบมีกี่รายการ" },
  { id: "T2",  q: "จังหวัดเชียงใหม่อยู่ภาคอะไร มีอำเภอกี่อำเภอ" },
  { id: "T3",  q: "สถานะเครื่อง docker และ evidence db ตอนนี้เป็นอย่างไร" },
  { id: "T4",  q: "บอกข้อมูลพื้นฐานเกี่ยวกับประเทศไทยและภูมิศาสตร์" },
  { id: "T5",  q: "พยากรณ์อากาศพรุ่งนี้ที่กรุงเทพมหานครเป็นอย่างไร" },
  { id: "T6",  q: "คำนวณ 15% ของ 87450 บาทเท่ากับเท่าไหร่" },
  { id: "T7",  q: "วันนี้วันที่เท่าไหร่ และอีก 45 วันจะตรงกับวันอะไร" },
  { id: "T8",  q: "สวัสดีครับ ช่วยแนะนำตัวเองหน่อยได้ไหม" },
  { id: "T9",  q: "วางแผนระบบรักษาความปลอดภัยสำหรับสถานีตำรวจ 3 จังหวัด" },
  { id: "T10", q: "เขียน Python function ดึงข้อมูล JSON จาก REST API พร้อม error handling" },
];

async function runOne(id: string, query: string) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`[${id}] Query: ${query}`);
  console.log(`${"=".repeat(80)}`);

  const events: AgentEvent[] = [];
  const start = Date.now();

  const emit = (ev: AgentEvent) => {
    events.push(ev);
    if (ev.type === "agent_started") {
      const modelInfo = ev.model ? ` (${ev.model})` : "";
      console.log(`  ▸ [${ev.agentId}] started${modelInfo}`);
    } else if (ev.type === "agent_delta" && ev.publicSummary && ev.publicSummary.length > 30) {
      console.log(`  📝 [${ev.agentId}] ${ev.publicSummary.substring(0, 120)}${ev.publicSummary.length > 120 ? "..." : ""}`);
    } else if (ev.type === "agent_finished") {
      console.log(`  ✓ [${ev.agentId}] finished`);
    } else if (ev.type === "fallback") {
      console.log(`  ⚠ [${ev.agentId}] fallback: ${ev.publicSummary}`);
    } else if (ev.type === "route_selected") {
      console.log(`  🗺️  route: ${ev.publicSummary}`);
    }
  };

  try {
    const result = await runConductor({ message: query }, emit);
    const elapsed = Date.now() - start;
    console.log(`\n  ⏱️  Elapsed: ${elapsed}ms`);
    console.log(`  🧠 Intent: ${result.intent}`);
    console.log(`  📊 Events: ${events.length}`);

    const mdesAgents = events.filter((e) => e.type === "agent_started" && e.model && !e.agentId?.includes("broker"));
    const models = [...new Set(mdesAgents.map((e) => e.model).filter(Boolean))];
    console.log(`  🤖 MDES models used: ${models.join(", ") || "(none)"}`);

    console.log(`\n  💬 Final answer:`);
    console.log(`     ${result.finalText.substring(0, 400)}${result.finalText.length > 400 ? "..." : ""}`);
    return { id, query, intent: result.intent, elapsed, models, finalText: result.finalText };
  } catch (err) {
    console.error(`  ❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    return { id, query, error: String(err) };
  }
}

(async () => {
  console.log("=== INNOMCP MDES Direct Dispatch Test ===");
  console.log(`OLLAMA_URL: ${process.env.OLLAMA_URL || "(default)"}`);
  console.log(`OLLAMA_API_KEY: ${process.env.OLLAMA_API_KEY ? "set" : "MISSING"}`);
  console.log(`PARALLEL_AGENTS: ${process.env.PARALLEL_AGENTS || "(unset)"}`);
  const results = [];
  for (const { id, q } of QUERIES) {
    results.push(await runOne(id, q));
  }
  console.log("\n=== SUMMARY ===");
  const summaryRows: string[] = [];
  for (const r of results) {
    if ("error" in r && r.error) {
      const msg = `  [${r.id}] ❌ ${r.query} — ${r.error}`;
      console.log(msg);
      summaryRows.push(msg);
    } else if ("intent" in r && r.finalText && r.models) {
      const ok = r.finalText.length > 30 && !r.finalText.startsWith("ผมรับโจทย์");
      const msg = `  [${r.id}] ${ok ? "✅" : "⚠️ "} intent=${r.intent} ${r.elapsed}ms models=${r.models.join("+")}`;
      console.log(msg);
      summaryRows.push(msg);
    }
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const evidenceDir = path.resolve(__dirname, "..", "..", "evidence", "phase-10-16");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidenceFile = path.join(evidenceDir, `mdes-direct_${ts}.json`);
  fs.writeFileSync(evidenceFile, JSON.stringify({ timestamp: ts, results, summary: summaryRows }, null, 2));
  console.log(`\n📁 Evidence: ${evidenceFile}`);
  process.exit(0);
})();
