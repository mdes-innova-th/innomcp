import http from "http";
import fs from "fs";
import path from "path";

type ChatJson = {
  text?: string;
  structuredContent?: any;
  mcpUsed?: boolean;
  mcpResults?: any[] | null;
};

function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function postJson(
  port: number,
  urlPath: string,
  body: any,
  headers: Record<string, string> = {}
): Promise<{ status: number; json: any; raw: string; durMs: number }> {
  const payload = Buffer.from(JSON.stringify(body));
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: urlPath,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(payload.length),
          ...headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c))));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let json: any = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode || 0, json, raw, durMs: Date.now() - start });
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function assertTrue(cond: any, label: string, failures: string[]) {
  if (!cond) failures.push(label);
}

function summarizeText(t: string, max = 160): string {
  const s = String(t || "").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max) + "…" : s;
}

type Case = {
  id: string;
  message: string;
  expectGeneral: boolean;
  expectFallback?: boolean;
  // Additional sanity assertions for non-general cases
  forbidTools?: RegExp[];
};

async function main() {
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  process.env.SMOKE_MODE = "1";
  process.env.CHAT_TRACE_QA = "1";
  process.env.SERVER_HOST = "127.0.0.1";

  const stamp = nowStamp();
  const evidenceDir = path.resolve(__dirname, "..", "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidenceLog = path.join(evidenceDir, `phase74-general-${stamp}.log`);

  const logLines: string[] = [];
  const failures: string[] = [];

  const { default: app } = await import("../src/app");
  const server = http.createServer(app as any);

  const port = await new Promise<number>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") return reject(new Error("Failed to bind ephemeral port"));
      resolve(addr.port);
    });
  });

  const budgetMs = 5000;
  logLines.push(`phase74 verifier start: port=${port}`);
  logLines.push(`env: SMOKE_MODE=${process.env.SMOKE_MODE} CHAT_TRACE_QA=${process.env.CHAT_TRACE_QA} budgetMs=${budgetMs}`);

  const cases: Case[] = [
    // ===== GENERAL (should route=general, no tools) =====
    { id: "G01", message: "ช่วยอธิบายความแตกต่างระหว่าง AI กับ Machine Learning แบบสั้นๆ", expectGeneral: true },
    { id: "G02", message: "RAG คืออะไร และเหมาะกับงานแบบไหน", expectGeneral: true },
    { id: "G03", message: "ช่วยยกตัวอย่าง OKR ของทีมซัพพอร์ต 1 ชุด", expectGeneral: true },
    { id: "G04", message: "ช่วยเขียนอีเมลขอเลื่อนนัดประชุมให้สุภาพ 3 ประโยค", expectGeneral: true },
    { id: "G05", message: "ขอแนวทางเขียน SOP ให้คนทำตามได้ง่าย", expectGeneral: true },
    { id: "G06", message: "อธิบาย Docker คืออะไร สำหรับคนเริ่มต้น", expectGeneral: true },
    { id: "G07", message: "ช่วยสรุปใจความสำคัญจากข้อความนี้: วันนี้ทีมจะปรับปรุงระบบและอาจมี downtime สั้นๆ", expectGeneral: true },
    { id: "G08", message: "ควรตั้งคำถามกับผู้ใช้อย่างไรเพื่อแก้ปัญหาให้เร็วขึ้น", expectGeneral: true },
    { id: "G09", message: "ช่วยแนะนำโครงสร้างการพรีเซนต์ 5 นาทีเรื่องความปลอดภัยข้อมูล", expectGeneral: true },
    { id: "G10", message: "ทำไมการทำ log ถึงสำคัญกับระบบหลังบ้าน", expectGeneral: true },
    { id: "G11", message: "อธิบายคำว่า KPI แบบเข้าใจง่าย", expectGeneral: true },
    { id: "G12", message: "ขอวิธีจัดการความเครียดก่อนขึ้นพรีเซนต์", expectGeneral: true },
    { id: "G13", message: "ช่วยออกแบบ checklist ตรวจงานก่อน deploy แบบสั้นๆ", expectGeneral: true },
    { id: "G14", message: "ช่วยยกตัวอย่าง prompt ที่ดีสำหรับให้ AI สรุปเอกสาร", expectGeneral: true },
    { id: "G15", message: "อธิบายข้อดีข้อเสียของการใช้ WebSocket เทียบกับ HTTP", expectGeneral: true },
    { id: "G16", message: "ช่วยแนะนำวิธีแบ่งงานเป็น task ย่อยๆ เพื่อทำงานให้เสร็จเร็วขึ้น", expectGeneral: true },
    { id: "G17", message: "หลักการเขียนข้อความแจ้งเตือนผู้ใช้ให้ชัดเจนควรมีอะไรบ้าง", expectGeneral: true },
    { id: "G18", message: "PHASE74_FORCE_TIMEOUT: อธิบายการจัดการงบเวลา (budget) ของโมเดลแบบง่าย", expectGeneral: true, expectFallback: true },

    // ===== MIXED / NOT GENERAL (must NOT route=general) =====
    { id: "M19", message: "พรุ่งนี้เชียงใหม่ฝนตกไหม", expectGeneral: false, forbidTools: [] },
    { id: "M20", message: "รหัสไปรษณีย์ 10210 อยู่เขตอะไร", expectGeneral: false, forbidTools: [/nwp|tmd|weather/i] },
    { id: "M21", message: "ตอนนี้เครื่องออนไลน์กี่เครื่อง", expectGeneral: false, forbidTools: [/dateTimeTool/i, /system_status_tool/i] },
    { id: "M22", message: "เมื่อวาน evidence ได้เท่าไหร่ แยกตาม ISP และใครมากสุด", expectGeneral: false, forbidTools: [/dateTimeTool/i, /system_status_tool/i] },
    { id: "M23", message: "เช็ค docker ค้างไหม", expectGeneral: false },
    { id: "M24", message: "กรุงเทพ หลักสี่ และลาดกระบังฝนตกไหม", expectGeneral: false },
    { id: "M25", message: "ตอนนี้กี่โมง", expectGeneral: false },
  ];

  let pass = 0;

  try {
    for (const c of cases) {
      const cid = `phase74-${stamp}-${c.id}`;
      const r = await postJson(
        port,
        "/api/chat",
        { message: c.message, messages: [], uiMode: "auto" },
        { "X-Smoke-Run": "1", "X-Correlation-Id": cid }
      );

      const json = (r.json || {}) as ChatJson;
      const text = String(json.text || r.raw || "");
      const sc = json.structuredContent;
      const gg = sc?.generalGate;
      const route = gg?.route;
      const usedTools = gg?.usedTools;
      const mcpUsed = json.mcpUsed;

      logLines.push(
        [
          `${c.id} durMs=${r.durMs} status=${r.status}`,
          `expectGeneral=${c.expectGeneral}`,
          `route=${route || "(none)"}`,
          `mcpUsed=${String(mcpUsed)}`,
          `text=${summarizeText(text, 140)}`,
        ].join(" | ")
      );

      // Budget sanity (either answered quickly or fallback quickly)
      assertTrue(r.durMs <= budgetMs + 750, `${c.id}: budget exceeded durMs=${r.durMs}`, failures);

      if (c.expectGeneral) {
        assertTrue(route === "general", `${c.id}: route must be general`, failures);
        assertTrue(usedTools === false, `${c.id}: usedTools must be false`, failures);
        assertTrue(mcpUsed === false, `${c.id}: mcpUsed must be false`, failures);
        assertTrue(json.mcpResults == null, `${c.id}: mcpResults must be null`, failures);
        assertTrue(text.trim().length > 0, `${c.id}: text must be non-empty`, failures);
        if (c.expectFallback) {
          assertTrue(gg?.fallback === true, `${c.id}: fallback must be true`, failures);
        }
      } else {
        // Must not be GeneralGate
        assertTrue(!gg, `${c.id}: must not be handled by GeneralGate`, failures);

        // If tool results exist, apply forbidTools sanity rules
        if (Array.isArray(json.mcpResults) && c.forbidTools && c.forbidTools.length > 0) {
          const toolNames = json.mcpResults.map((x: any) => String(x?.toolName || "")).filter(Boolean);
          for (const re of c.forbidTools) {
            const hit = toolNames.find((n) => re.test(n));
            assertTrue(!hit, `${c.id}: forbidden tool selected: ${hit}`, failures);
          }
        }
      }

      pass++;
    }
  } finally {
    try {
      const chatMod: any = await import("../src/routes/api/chat");
      const toolHealthChecker = chatMod?.toolHealthChecker;
      const mcpClient = chatMod?.mcpClient;
      if (toolHealthChecker && typeof toolHealthChecker.stopHealthChecks === "function") {
        toolHealthChecker.stopHealthChecks();
      }
      if (mcpClient && typeof mcpClient.shutdown === "function") {
        await mcpClient.shutdown();
      } else if (mcpClient && typeof mcpClient.stopHealthCheck === "function") {
        mcpClient.stopHealthCheck();
      }
    } catch {
      // ignore
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  const ok = failures.length === 0;
  logLines.push(ok ? "RESULT: PASS" : "RESULT: FAIL");
  logLines.push(`PASS_COUNT: ${ok ? cases.length : pass}/${cases.length}`);
  if (!ok) {
    logLines.push("FAILURES:");
    for (const f of failures) logLines.push("- " + f);
  }

  fs.writeFileSync(evidenceLog, logLines.join("\n") + "\n", "utf8");
  console.log(`evidence: ${evidenceLog}`);
  if (!ok) console.error(logLines.join("\n"));
  process.exitCode = ok ? 0 : 1;

  const t = setTimeout(() => process.exit(process.exitCode || 0), 300);
  // @ts-ignore
  if (typeof (t as any).unref === "function") (t as any).unref();
}

main().catch((err) => {
  console.error("verify_phase74_general_25cases failed:", err);
  process.exitCode = 1;
});
