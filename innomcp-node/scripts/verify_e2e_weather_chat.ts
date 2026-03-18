/*
 * E2E Weather Chat Smoke Test — 10 queries, checks Thai output + routing correctness
 * Spawns ephemeral server with WEATHER_FIXTURE_W1=1 (no live API calls).
 * Usage: WEATHER_FIXTURE_W1=1 npx ts-node scripts/verify_e2e_weather_chat.ts
 */

import http from "http";
import path from "path";
import fs from "fs";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function assert(cond: any, msg: string, failures: string[]) {
  if (!cond) failures.push(msg);
}

function postChat(port: number, message: string): Promise<{ status: number; json: any }> {
  const payload = Buffer.from(JSON.stringify({ message, uiMode: "auto" }));
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: "127.0.0.1",
      port,
      path: "/api/chat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(payload.length),
        "X-Smoke-Run": "1",
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c))));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let json: any = null;
        try { json = raw ? JSON.parse(raw) : null; } catch { json = null; }
        resolve({ status: res.statusCode || 0, json });
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function startServer() {
  process.env.NODE_ENV = "test";
  process.env.INNOMCP_MODE = "offline";
  process.env.SMOKE_MODE = "1";
  process.env.WEATHER_FIXTURE_W1 = "1";
  process.env.CHAT_TRACE_QA = "0";
  process.env.LOG_DEBUG = "0";
  process.env.SERVER_HOST = "127.0.0.1";

  const { default: app } = await import("../src/app");
  const server = http.createServer(app as any);
  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", resolve);
    server.on("error", reject);
  });
  const port = (server.address() as any).port as number;
  const stop = async () => {
    try {
      const chatMod: any = await import("../src/routes/api/chat");
      if (chatMod?.toolHealthChecker?.stopHealthChecks) chatMod.toolHealthChecker.stopHealthChecks();
      if (chatMod?.mcpClient?.shutdown) await chatMod.mcpClient.shutdown();
    } catch {}
    await new Promise<void>((r) => server.close(() => r()));
  };
  return { port, stop };
}

// Test cases: [query, expectedRoute, mustContain[], mustNotContain[], wantsUpdateTime]
type Case = {
  q: string;
  label: string;
  wantsWeather: boolean;   // should use weatherPipeline
  wantsUpdateTime: boolean; // answer must include เวลาอัปเดตข้อมูล
  noJson: boolean;           // answer must not look like JSON
  mustContain?: RegExp[];
  mustNotContain?: RegExp[];
};

const CASES: Case[] = [
  {
    q: "อากาศกรุงเทพวันนี้เป็นอย่างไร",
    label: "bkk_today",
    wantsWeather: true, wantsUpdateTime: true, noJson: true,
    mustContain: [/กรุงเทพ/i, /โอกาสฝน/i],
  },
  {
    q: "ตอนนี้ภูเก็ตฝนตกไหม",
    label: "phuket_now",
    wantsWeather: true, wantsUpdateTime: true, noJson: true,
    mustContain: [/ภูเก็ต/i, /โอกาสฝน/i],
  },
  {
    q: "พรุ่งนี้เชียงใหม่ฝนตกไหม",
    label: "chiangmai_tomorrow",
    wantsWeather: true, wantsUpdateTime: true, noJson: true,
    mustContain: [/เชียงใหม่/i, /โอกาสฝน/i],
  },
  {
    q: "สรุปอากาศภาคกลางวันนี้",
    label: "central_today",
    wantsWeather: true, wantsUpdateTime: false, noJson: true,
    mustContain: [/กรุงเทพ|ภาคกลาง|จังหวัด/i],
  },
  {
    q: "ตารางอากาศลำปาง",
    label: "lampang_table",
    wantsWeather: true, wantsUpdateTime: false, noJson: true,
    mustContain: [/จังหวัด|ฝน|อุณหภูมิ|%ฝน/i],
  },
  {
    q: "จังหวัดไหนฝนมากสุดวันนี้",
    label: "nationwide_rain",
    wantsWeather: true, wantsUpdateTime: false, noJson: true,
    mustContain: [/จังหวัด|ฝน/i],
  },
  {
    q: "วันนี้โคราชร้อนแค่ไหน",
    label: "korat_heat",
    wantsWeather: true, wantsUpdateTime: true, noJson: true,
    mustContain: [/นครราชสีมา|โคราช|อุณหภูมิ/i],
  },
  {
    q: "ตอนนี้กทมลมแรงไหม",
    label: "bkk_wind_now",
    wantsWeather: true, wantsUpdateTime: true, noJson: true,
    mustContain: [/กรุงเทพ/i, /ลม/i],
  },
  {
    q: "อากาศสัปดาห์นี้ที่สงขลา",
    label: "songkhla_week",
    wantsWeather: true, wantsUpdateTime: true, noJson: true,
    mustContain: [/สงขลา/i, /โอกาสฝน/i],
  },
  {
    q: "xzqvmumbo-jumbo-9999",
    label: "ambiguous_fallback",
    wantsWeather: false, wantsUpdateTime: false, noJson: true,
    mustContain: [/ระบุ|ข้อมูล|ต้องการ/i],
  },
];

async function main() {
  const stamp = nowStamp();
  const evidenceDir = path.resolve(__dirname, "..", "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidenceFile = path.join(evidenceDir, `e2e-weather-chat-${stamp}.log`);

  const lines: string[] = [];
  const failures: string[] = [];

  lines.push(`E2E Weather Chat Smoke — ${stamp}`);
  lines.push(`CONFIG: WEATHER_FIXTURE_W1=1 SMOKE_MODE=1`);
  lines.push("");

  const { port, stop } = await startServer();
  lines.push(`Server started on port ${port}`);
  lines.push("");

  try {
    let passed = 0;
    let failed = 0;

    for (const tc of CASES) {
      let r: { status: number; json: any };
      try {
        r = await postChat(port, tc.q);
      } catch (e: any) {
        const msg = `[${tc.label}] NETWORK_ERROR: ${e?.message || e}`;
        failures.push(msg);
        lines.push(`❌ ${tc.label}: NETWORK_ERROR`);
        failed++;
        continue;
      }

      const text = String(r.json?.text || "");
      const toolsUsed: string[] = r.json?.toolsUsed || [];
      const chatMeta = r.json?.structuredContent?.chatMeta;
      const caseFailures: string[] = [];

      // Status 200
      assert(r.status === 200, `status=${r.status} (expected 200)`, caseFailures);

      // Non-empty text
      assert(text.length > 0, `empty answer`, caseFailures);

      // Weather routing
      if (tc.wantsWeather) {
        assert(toolsUsed.includes("weatherPipeline"), `toolsUsed missing weatherPipeline (got ${JSON.stringify(toolsUsed)})`, caseFailures);
      }

      // Update time in text when expected
      if (tc.wantsUpdateTime) {
        assert(/เวลาอัปเดตข้อมูล\s*:/i.test(text), `missing เวลาอัปเดตข้อมูล`, caseFailures);
      }

      // No JSON leaking (no raw { or [ starting the text)
      if (tc.noJson) {
        assert(!/^\s*[{\[]/.test(text), `answer starts with JSON bracket: ${text.slice(0,40)}`, caseFailures);
        assert(!/\[JSON_REDACTED\]/.test(text), `answer contains JSON_REDACTED`, caseFailures);
      }

      // Must contain patterns
      for (const re of (tc.mustContain || [])) {
        assert(re.test(text), `answer missing pattern ${re}: ${text.slice(0,80)}`, caseFailures);
      }

      // Must NOT contain patterns
      for (const re of (tc.mustNotContain || [])) {
        assert(!re.test(text), `answer has forbidden pattern ${re}`, caseFailures);
      }

      // Ambiguous: check chatMeta
      if (tc.label === "ambiguous_fallback") {
        assert(chatMeta?.reason_code === "LOW_CONTEXT", `chatMeta.reason_code not LOW_CONTEXT (got ${chatMeta?.reason_code})`, caseFailures);
        assert(Array.isArray(chatMeta?.userGuidance) && chatMeta.userGuidance.length > 0, `chatMeta.userGuidance missing`, caseFailures);
      }

      if (caseFailures.length === 0) {
        lines.push(`✅ ${tc.label}: ${text.slice(0, 100).replace(/\n/g, " ")}`);
        passed++;
      } else {
        lines.push(`❌ ${tc.label}: ${caseFailures.join("; ")}`);
        lines.push(`   answer: ${text.slice(0, 120).replace(/\n/g, " ")}`);
        failures.push(...caseFailures.map(f => `[${tc.label}] ${f}`));
        failed++;
      }
    }

    lines.push("");
    lines.push(`PASSED: ${passed}/${CASES.length}  FAILED: ${failed}/${CASES.length}`);
    lines.push(failures.length === 0 ? "RESULT: PASS" : "RESULT: FAIL");
    if (failures.length > 0) {
      lines.push("FAILURES:");
      failures.forEach(f => lines.push(`  - ${f}`));
    }

  } finally {
    await stop();
  }

  const out = lines.join("\n") + "\n";
  fs.writeFileSync(evidenceFile, out, "utf8");
  process.stdout.write(out);

  if (failures.length > 0) process.exit(1);
}

main().catch(e => { console.error(String(e?.stack || e)); process.exit(1); });
