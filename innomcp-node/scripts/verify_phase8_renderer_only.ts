/*
Phase 8 Verifier: LLM as Renderer Only (NO decision-making)

Goals:
- Deterministic gates decide route (weather/geo/evidence/general).
- LLM must not decide route/tool selection.
- User-facing text must be professional Thai; no JSON fences; no env-var leaks; no "test/stub/fixture" vibe.

Evidence outputs (untracked):
- Trace v3 log containing only [ChatTrace] lines
- JSON summary report
*/

import net from "net";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";

type ChatResponse = {
  text?: string;
  structuredContent?: any;
  mcpUsed?: boolean;
  mcpResults?: any[] | null;
};

type Phase8RenderMeta = {
  route: "weather" | "geo" | "evidence" | "general";
  llmUsed: boolean;
  routeDecider: "deterministic";
  version: "phase8";
};

type Case = {
  id: string;
  message: string;
  expectRoute: Phase8RenderMeta["route"];
  mustInclude?: RegExp[];
  mustNotInclude?: RegExp[];
};

type CaseResult = {
  id: string;
  message: string;
  expectRoute: Case["expectRoute"];
  status: number;
  durMs: number;
  ok: boolean;
  failures: string[];
  route?: string;
  llmUsed?: boolean;
  routeDecider?: string;
  version?: string;
  textPreview: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      srv.close(() => {
        if (addr && typeof addr === "object") resolve(addr.port);
        else reject(new Error("Failed to acquire free port"));
      });
    });
    srv.on("error", reject);
  });
}

async function waitForHealth(baseUrl: string, timeoutMs: number): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const r = await fetch(`${baseUrl}/health`);
      if (r.ok) return;
    } catch {
      // ignore
    }
    await sleep(200);
  }
  throw new Error("Server health check timeout");
}

function summarizeText(t: string, max = 220): string {
  const s = String(t || "").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function containsThai(text: string): boolean {
  return /[\u0E00-\u0E7F]/.test(String(text || ""));
}

function assertTrue(cond: any, label: string, failures: string[]) {
  if (!cond) failures.push(label);
}

async function postChat(baseUrl: string, correlationId: string, message: string): Promise<{ status: number; json: ChatResponse | null; raw: string; durMs: number }> {
  const start = Date.now();
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-correlation-id": correlationId,
      "x-smoke-run": "1",
    },
    body: JSON.stringify({ message, uiMode: "auto", messages: [] }),
  });
  const raw = await res.text().catch(() => "");
  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, raw, durMs: Date.now() - start };
}

function buildForbiddenRegexes(): RegExp[] {
  return [
    /```/,
    /^\s*[\[{]/,
    /\bjsonrpc\b/i,
    /\bstructuredContent\b/i,
    /\bmcpResults\b/i,
    /\btoolName\b/i,

    // "test/stub/fixture" vibes
    /\bSMOKE\b/i,
    /SMOKE_MODE/i,
    /\bfixture\b/i,
    /\bstub\b/i,
    /\bdummy\b/i,
    /test\s*mode/i,

    // env leaks / secrets
    /process\.env/i,
    /\bOPENAI\b/i,
    /\bOLLAMA\b/i,
    /\bAPI[_-]?KEY\b/i,
    /\bSECRET\b/i,
    /\bPASSWORD\b/i,
    /\bTOKEN\b/i,
    /\bMCP[_-]?/i,
    /SERVER_HOST/i,
    /SERVER_PORT/i,
  ];
}

function parseRenderMeta(sc: any): Phase8RenderMeta | null {
  const meta = sc?.__render;
  if (!meta || typeof meta !== "object") return null;
  if (typeof meta.route !== "string") return null;
  return meta as Phase8RenderMeta;
}

function normalizeLineEndings(s: string): string {
  return String(s || "").replace(/\r\n/g, "\n");
}

function parseTraceLine(line: string): { transport?: string; route?: string; answer?: string } | null {
  if (!line.includes("[ChatTrace]")) return null;
  const tMatch = line.match(/\bt=(http|ws)\b/);
  const routeMatch = line.match(/\broute=([^\s]+)\b/);
  const aMatch = line.match(/\ba='([^']*)'/);
  return {
    transport: tMatch?.[1],
    route: routeMatch?.[1],
    answer: aMatch?.[1],
  };
}

async function run() {
  const port = await getFreePort();
  const host = "127.0.0.1";
  const baseUrl = `http://${host}:${port}`;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const cidBase = `phase8-renderer-${stamp}`;
  const cidShort = cidBase.slice(0, 8);

  const evidenceDir = path.join(__dirname, "..", "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });

  const evidenceTraceFile = path.join(evidenceDir, `phase8-renderer-only-tracev3-${stamp}.log`);
  const evidenceJsonFile = path.join(evidenceDir, `phase8-renderer-only-${stamp}.json`);
  const evidenceOutFile = path.join(evidenceDir, `phase8-renderer-only-${stamp}.out.log`);

  const isWin = process.platform === "win32";
  const cmd = isWin ? "cmd.exe" : "npx";
  const args = isWin ? ["/d", "/c", "npx ts-node src/index.ts"] : ["ts-node", "src/index.ts"];

  const traceLines: string[] = [];
  const onData = (buf: Buffer) => {
    const chunk = buf.toString("utf8");
    for (const l of chunk.split(/\r?\n/)) {
      if (l.includes("[ChatTrace]")) traceLines.push(l.trim());
    }
  };

  const child = spawn(cmd, args, {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      SERVER_HOST: host,
      SERVER_PORT: String(port),
      NODE_ENV: "test",
      SMOKE_MODE: "1",
      CHAT_TRACE_QA: "1",
      LOG_DEBUG: "0",
      LOG_MODE: "test",

      // Deterministic, zero-network weather fixtures (already used in Phase W1).
      WEATHER_FIXTURE_W1: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);

  const forbidden = buildForbiddenRegexes();

  const cases: Case[] = [
    // ===== WEATHER =====
    { id: "W01", message: "ตอนนี้ กทม ฝนตกไหม", expectRoute: "weather", mustInclude: [/ช่วงเวลา\s*:/, /-\s*กรุงเทพ/i] },
    { id: "W02", message: "วันนี้ กทม ฝนจะตกช่วงไหน", expectRoute: "weather", mustInclude: [/ช่วงเวลา\s*:/] },
    { id: "W03", message: "พรุ่งนี้ เชียงใหม่ ฝนตกไหม", expectRoute: "weather" },
    { id: "W04", message: "มะรืน ภูเก็ต อุณหภูมิประมาณเท่าไหร่", expectRoute: "weather" },
    { id: "W05", message: "กรุงเทพ หลักสี่ และลาดกระบังฝนตกไหม", expectRoute: "weather", mustInclude: [/สรุปสภาพอากาศ\s*:/] },
    { id: "W06", message: "รายชั่วโมง โคราช ฝนตกไหม", expectRoute: "weather" },

    // ===== GEO =====
    { id: "G07", message: "รหัสไปรษณีย์ 10210 อยู่เขตอะไร", expectRoute: "geo", mustInclude: [/คำตอบ\s*:/] },
    { id: "G08", message: "บางนา อยู่เขตอะไร", expectRoute: "geo", mustInclude: [/คำตอบ\s*:/] },
    { id: "G09", message: "ถนนพหลโยธิน 5 อยู่เขตอะไร", expectRoute: "geo" },
    { id: "G10", message: "ตำบลสุเทพ อยู่จังหวัดอะไร", expectRoute: "geo" },
    { id: "G11", message: "บางรัก อยู่จังหวัดอะไร", expectRoute: "geo" },
    { id: "G12", message: "บางรัก อยู่ที่ไหน (เขต/อำเภอ/จังหวัด)?", expectRoute: "geo" },

    // ===== EVIDENCE =====
    { id: "E13", message: "เมื่อวาน evidence ได้เท่าไหร่", expectRoute: "evidence" },
    { id: "E14", message: "วันนี้ evidence ได้เท่าไหร่", expectRoute: "evidence" },
    { id: "E15", message: "เมื่อวาน evidence แยกตาม ISP และใครมากสุด", expectRoute: "evidence" },
    { id: "E16", message: "วันนี้ มี URL detected กี่รายการ", expectRoute: "evidence" },
    { id: "E17", message: "ตอนนี้เครื่องออนไลน์กี่เครื่อง", expectRoute: "evidence" },
    { id: "E18", message: "วันนี้มีเครื่องที่ evidence active กี่เครื่อง", expectRoute: "evidence" },

    // ===== GENERAL =====
    { id: "N19", message: "ช่วยสรุปความแตกต่างระหว่าง AI กับ Machine Learning แบบสั้นๆ", expectRoute: "general", mustInclude: [/[\u0E00-\u0E7F]/] },
    { id: "N20", message: "ขอแนวทางเขียน SOP ให้คนทำตามได้ง่าย", expectRoute: "general", mustInclude: [/[\u0E00-\u0E7F]/] },
    { id: "N21", message: "ช่วยเขียนอีเมลขอเลื่อนนัดประชุมให้สุภาพ 3 ประโยค", expectRoute: "general", mustInclude: [/[\u0E00-\u0E7F]/] },
    { id: "N22", message: "RAG คืออะไร และเหมาะกับงานแบบไหน", expectRoute: "general", mustInclude: [/[\u0E00-\u0E7F]/] },
    { id: "N23", message: "อธิบาย Docker คืออะไร สำหรับคนเริ่มต้น", expectRoute: "general", mustInclude: [/[\u0E00-\u0E7F]/] },
    { id: "N24", message: "PHASE74_FORCE_TIMEOUT: อธิบายการจัดการงบเวลา (budget) ของโมเดลแบบง่าย", expectRoute: "general", mustInclude: [/[\u0E00-\u0E7F]/] },
    { id: "N25", message: "ช่วยออกแบบ checklist ตรวจงานก่อน deploy แบบสั้นๆ", expectRoute: "general", mustInclude: [/[\u0E00-\u0E7F]/] },
  ];

  const results: CaseResult[] = [];
  const globalFailures: string[] = [];

  const startAll = Date.now();

  try {
    await waitForHealth(baseUrl, 15_000);

    for (const c of cases) {
      const correlationId = `${cidBase}-${c.id}`;
      const failures: string[] = [];

      const r = await postChat(baseUrl, correlationId, c.message);

      const json = r.json;
      const text = normalizeLineEndings(String(json?.text ?? r.raw ?? ""));
      const textPreview = summarizeText(text, 200);

      assertTrue(r.status === 200, `${c.id}: http_status expected=200 got=${r.status}`, failures);
      assertTrue(text.trim().length > 0, `${c.id}: text must be non-empty`, failures);
      assertTrue(!/^\s*#/.test(text), `${c.id}: must not use markdown headings`, failures);

      // Forbidden tokens (no env leaks, no JSON fences, no stub vibe)
      for (const re of forbidden) {
        if (re.test(text)) {
          failures.push(`${c.id}: forbidden_token ${String(re)}`);
          break;
        }
      }

      // Must include Thai for user-facing answers
      assertTrue(containsThai(text), `${c.id}: text must contain Thai characters`, failures);

      const sc = json?.structuredContent;
      const meta = parseRenderMeta(sc);
      assertTrue(!!meta, `${c.id}: structuredContent.__render missing`, failures);

      const route = meta?.route;
      const llmUsed = meta?.llmUsed;
      const routeDecider = (meta as any)?.routeDecider;
      const version = (meta as any)?.version;

      assertTrue(route === c.expectRoute, `${c.id}: route expected=${c.expectRoute} got=${String(route)}`, failures);
      assertTrue(routeDecider === "deterministic", `${c.id}: routeDecider must be deterministic`, failures);
      assertTrue(version === "phase8", `${c.id}: version must be phase8`, failures);

      if (c.expectRoute !== "general") {
        assertTrue(llmUsed === false, `${c.id}: llmUsed must be false for non-general routes`, failures);
      }

      // Route-specific quality markers
      if (c.expectRoute === "weather") {
        const wpOk = (sc as any)?.weatherPipeline?.ok;
        const shouldCheckTemplate = wpOk !== false;
        if (shouldCheckTemplate) {
          assertTrue(/ช่วงเวลา\s*:/i.test(text), `${c.id}: weather must include ช่วงเวลา:`, failures);
          assertTrue(/\n-\s*/.test(text), `${c.id}: weather must include bullet lines`, failures);
        }
      }
      if (c.expectRoute === "geo") {
        assertTrue(/คำตอบ\s*:/i.test(text) || /คำถาม\s*:/i.test(text), `${c.id}: geo must include คำตอบ: or คำถาม:`, failures);
      }

      if (c.mustInclude) {
        for (const re of c.mustInclude) {
          assertTrue(re.test(text), `${c.id}: mustInclude failed ${String(re)}`, failures);
        }
      }
      if (c.mustNotInclude) {
        for (const re of c.mustNotInclude) {
          assertTrue(!re.test(text), `${c.id}: mustNotInclude hit ${String(re)}`, failures);
        }
      }

      results.push({
        id: c.id,
        message: c.message,
        expectRoute: c.expectRoute,
        status: r.status,
        durMs: r.durMs,
        ok: failures.length === 0,
        failures,
        route,
        llmUsed,
        routeDecider,
        version,
        textPreview,
      });
    }

    // Allow trace flush
    await sleep(500);

    const ours = traceLines.filter((l) => l.includes(`cid=${cidShort}`));

    // Minimal Trace v3 sanity: non-empty and parseable
    assertTrue(ours.length >= Math.floor(cases.length), `trace: expected >=${Math.floor(cases.length)} lines for cid=${cidShort}, got ${ours.length}`, globalFailures);

    const parsed = ours.map(parseTraceLine).filter((x) => x && x.transport && x.route) as any[];
    assertTrue(parsed.length >= Math.floor(cases.length), `trace: parse failed; parsed=${parsed.length} lines`, globalFailures);

    fs.writeFileSync(evidenceTraceFile, ours.join("\n") + "\n", "utf8");

  } finally {
    try {
      child.kill("SIGINT");
    } catch {}
    await sleep(300);
    try {
      child.kill("SIGKILL");
    } catch {}
  }

  const failures = [
    ...globalFailures,
    ...results.filter((r) => !r.ok).flatMap((r) => r.failures),
  ];

  const ok = failures.length === 0;
  const summary = {
    phase: "phase8-renderer-only",
    stamp,
    ok,
    host,
    port,
    env: {
      SMOKE_MODE: "1",
      CHAT_TRACE_QA: "1",
      WEATHER_FIXTURE_W1: "1",
    },
    evidence: {
      traceFile: evidenceTraceFile,
      jsonFile: evidenceJsonFile,
      outFile: evidenceOutFile,
    },
    stats: {
      total: results.length,
      pass: results.filter((r) => r.ok).length,
      fail: results.filter((r) => !r.ok).length,
      totalDurMs: Date.now() - startAll,
    },
    failures,
    cases: results,
  };

  fs.writeFileSync(evidenceJsonFile, JSON.stringify(summary, null, 2) + "\n", "utf8");

  const outLines: string[] = [];
  outLines.push(ok ? "RESULT: PASS" : "RESULT: FAIL");
  outLines.push(`TOTAL: ${summary.stats.total} PASS: ${summary.stats.pass} FAIL: ${summary.stats.fail}`);
  outLines.push(`evidenceTraceFile=${evidenceTraceFile}`);
  outLines.push(`evidenceJsonFile=${evidenceJsonFile}`);
  if (!ok) {
    outLines.push("FAILURES:");
    for (const f of failures.slice(0, 80)) outLines.push("- " + f);
  }
  fs.writeFileSync(evidenceOutFile, outLines.join("\n") + "\n", "utf8");

  console.log(outLines.join("\n"));
  process.exitCode = ok ? 0 : 1;

  const t = setTimeout(() => process.exit(process.exitCode || 0), 300);
  // @ts-ignore
  if (typeof (t as any).unref === "function") (t as any).unref();
}

run().catch((e) => {
  console.error(String(e?.stack || e));
  process.exit(1);
});
