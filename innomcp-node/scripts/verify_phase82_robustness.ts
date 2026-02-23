/*
Phase 8.2 Verifier: Non-seeded Robustness (Still Renderer-only)

Goal:
- Routing remains deterministic (NO LLM decision-making).
- Improve robustness for real Thai variants (typos/aliases/abbrev), without hallucinating.

What this verifier checks:
- structuredContent.__render exists and matches deterministic routing meta.
- No forbidden tokens: "โหมดทดสอบ", "เพื่อการทดสอบระบบ", placeholder weather strings.
- No env-var names in user-visible responses.
- GEO: either structured admin-path OR AMBIGUOUS Top3 + 1 follow-up question (non-trivia).
- WX: if 2 locations are requested -> both sections must appear.
- EVI: yesterday+ISP -> contains "ISP" + "มากที่สุด" OR ERR:CODE.

Evidence outputs (untracked):
- Trace v3 log containing only [ChatTrace] lines
- JSON summary report
- .out log summary
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

type RenderMeta = {
  route: "weather" | "geo" | "evidence" | "general";
  llmUsed: boolean;
  routeDecider: "deterministic";
  version: string;
};

type Case = {
  id: string;
  message: string;
  uiMode?: "auto" | "officer";
  expectRoute: RenderMeta["route"];
  kind: "GEO" | "WX2" | "EVI";
};

type CaseResult = {
  id: string;
  message: string;
  uiMode: string;
  kind: Case["kind"];
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

async function postChat(
  baseUrl: string,
  correlationId: string,
  message: string,
  uiMode: "auto" | "officer"
): Promise<{ status: number; json: ChatResponse | null; raw: string; durMs: number }> {
  const start = Date.now();
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-correlation-id": correlationId,
      "x-smoke-run": "1",
    },
    body: JSON.stringify({ message, uiMode, messages: [] }),
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
    /โหมดทดสอบ/i,
    /เพื่อการทดสอบระบบ/i,

    // Explicit placeholder weather text (must never appear)
    /อุณหภูมิ\s*30\s*°?C/i,
    /ความชื้น\s*70%/i,

    // env leaks / secrets
    /process\.env/i,
    /\bOPENAI\b/i,
    /\bOLLAMA\b/i,
    /\bAPI[_-]?KEY\b/i,
    /\bSECRET\b/i,
    /\bPASSWORD\b/i,
    /\bTOKEN\b/i,

    // MCP / infra / env-var names
    /\bMCP[_-]?/i,
    /SERVER_HOST/i,
    /SERVER_PORT/i,
    /MCPSERVER_URL/i,
    /DETECT_DB_/i,
    /REMOTE_OLLAMA_BASE_URL/i,
    /FAST_OLLAMA_MODEL/i,
  ];
}

function parseRenderMeta(sc: any): RenderMeta | null {
  const meta = sc?.__render;
  if (!meta || typeof meta !== "object") return null;
  if (typeof meta.route !== "string") return null;
  return meta as RenderMeta;
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

function isEvidenceIspYesterday(message: string): boolean {
  const t = String(message || "");
  return /(เมื่อวาน|เมื่อวานนี้|yesterday)/i.test(t) && /(isp|ผู้ให้บริการ|แยกตาม\s*isp)/i.test(t);
}

function geoLooksAmbiguous(text: string): boolean {
  const s = String(text || "");
  return /ตัวเลือก\s*\(Top\s*3\)\s*:/i.test(s) && /คำถาม\s*:/i.test(s);
}

function geoLooksResolved(text: string): boolean {
  const s = String(text || "");
  // resolved answers should contain an admin label; ambiguous handled separately
  return /(เขต|อำเภอ|แขวง|ตำบล|จังหวัด|รหัสไปรษณีย์)/.test(s) && /คำตอบ\s*:/i.test(s);
}

function geoQuestionNonTrivia(text: string): boolean {
  const s = String(text || "");
  const q = s.split(/คำถาม\s*:/i)[1] || "";
  return /(จังหวัด|เขต|อำเภอ|แขวง|ตำบล|รหัสไปรษณีย์|พื้นที่)/.test(q);
}

function wxHasTwoSections(text: string, a: string, b: string): boolean {
  const s = normalizeLineEndings(text);
  return new RegExp(`-\\s*เขต${a}`).test(s) && new RegExp(`-\\s*เขต${b}`).test(s);
}

function evidenceHasIspMostOrErr(text: string): boolean {
  const s = String(text || "");
  const hasIspMost = /ISP/i.test(s) && /มากที่สุด/.test(s);
  const hasErr = /\bERR:[A-Z0-9_]+\b/.test(s);
  return hasIspMost || hasErr;
}

async function run() {
  const port = await getFreePort();
  const host = "127.0.0.1";
  const baseUrl = `http://${host}:${port}`;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const cidBase = `phase82-robust-${stamp}`;

  const evidenceDir = path.join(__dirname, "..", "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });

  const evidenceTraceFile = path.join(evidenceDir, `phase82-robustness-tracev3-${stamp}.log`);
  const evidenceJsonFile = path.join(evidenceDir, `phase82-robustness-${stamp}.json`);
  const evidenceOutFile = path.join(evidenceDir, `phase82-robustness-${stamp}.out.log`);

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

      // Deterministic, zero-network weather fixtures.
      WEATHER_FIXTURE_W1: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);

  const forbidden = buildForbiddenRegexes();

  const cases: Case[] = [
    // ===== GEO (15 near-miss / alias / ambiguous) =====
    { id: "G01", kind: "GEO", message: "กทม ลักสี่ อยู่เขตอะไร", expectRoute: "geo" },
    { id: "G02", kind: "GEO", message: "กรุงเทพฯ เขตลาดกระบัง อยู่จังหวัดอะไร", expectRoute: "geo" },
    { id: "G03", kind: "GEO", message: "ต.บ้านใหม่ อยู่ที่ไหน", expectRoute: "geo" },
    { id: "G04", kind: "GEO", message: "บ้านใหม่ อยู่จังหวัดไหน", expectRoute: "geo" },
    { id: "G05", kind: "GEO", message: "ท่าช้าง อยู่จังหวัดไหน", expectRoute: "geo" },
    { id: "G06", kind: "GEO", message: "หนองบัว อยู่ที่ไหน", expectRoute: "geo" },
    { id: "G07", kind: "GEO", message: "อำเภอเมือง อยู่จังหวัดไหน", expectRoute: "geo" },
    { id: "G08", kind: "GEO", message: "ตรวจสอบที่อยู่: จ.พระนครศรีอยุธยา อ.บางไทร ต.บ้านใหม่ 13190 ถูกไหม", expectRoute: "geo" },
    { id: "G09", kind: "GEO", message: "จัดรูปแบบที่อยู่: 99/1 ซ.1 ถ.สีลม แขวงสีลม เขตบางรัก กทม 10500", expectRoute: "geo" },
    { id: "G10", kind: "GEO", message: "รหัสไปรษณีย์ ๑๐๕๐๐ อยู่เขตอะไร", expectRoute: "geo" },
    { id: "G11", kind: "GEO", message: "กรุงเทพ เขตลาดกระบัง", expectRoute: "geo" },
    { id: "G12", kind: "GEO", message: "แขวงลุมพินี อยู่เขตอะไร", expectRoute: "geo" },
    { id: "G13", kind: "GEO", message: "จตุจักร อยู่จังหวัดอะไร", expectRoute: "geo" },
    { id: "G14", kind: "GEO", message: "โคราช อยู่จังหวัดอะไร", expectRoute: "geo" },
    { id: "G15", kind: "GEO", message: "เจียงใหม่ อยู่จังหวัดอะไร", expectRoute: "geo" },

    // ===== WEATHER (10 multi-location variants; must always render 2 sections) =====
    { id: "W01", kind: "WX2", message: "กทม ลักสี่ และ ลาดกระบังฯ ตอนนี้ฝนตกไหม", expectRoute: "weather" },
    { id: "W02", kind: "WX2", message: "กรุงเทพ เขตหลักสี่, เขตลาดกระบัง วันนี้ฝนจะตกไหม", expectRoute: "weather" },
    { id: "W03", kind: "WX2", message: "กรุงเทพมหานคร หลักสี่/ลาดกระบัง พรุ่งนี้อากาศเป็นไง", expectRoute: "weather" },
    { id: "W04", kind: "WX2", message: "กทม หลักสี่ กับ ลาดกระบัง อุณหภูมิประมาณเท่าไหร่", expectRoute: "weather" },
    { id: "W05", kind: "WX2", message: "กรุงเทพ บางรัก และ ปทุมวัน ตอนนี้ฝนตกไหม", expectRoute: "weather" },
    { id: "W06", kind: "WX2", message: "กทม บางรัก และ จตุจักร วันนี้ฝนตกไหม", expectRoute: "weather" },
    { id: "W07", kind: "WX2", message: "กรุงเทพมหานคร ปทุมวัน และ จตุจักร ตอนนี้อากาศเป็นไง", expectRoute: "weather" },
    { id: "W08", kind: "WX2", message: "กทม หลักสี่ และ ลาดกระบัง อากาศตอนนี้", expectRoute: "weather" },
    { id: "W09", kind: "WX2", message: "กรุงเทพฯ เขตหลักสี่ และ เขตลาดกระบัง วันนี้ฝน", expectRoute: "weather" },
    { id: "W10", kind: "WX2", message: "กรุงเทพ ลักสี่ & ลาดกระบัง ฝนตกไหม", expectRoute: "weather" },

    // ===== EVIDENCE (10 variants; yesterday+ISP most) =====
    { id: "E01", kind: "EVI", uiMode: "officer", message: "เมื่อวาน แยกตาม ISP อะไร มากที่สุด", expectRoute: "evidence" },
    { id: "E02", kind: "EVI", uiMode: "officer", message: "สรุปหลักฐานเมื่อวาน ISP ที่มากที่สุดคืออะไร", expectRoute: "evidence" },
    { id: "E03", kind: "EVI", uiMode: "officer", message: "รายงานเมื่อวาน แยกตาม isp top 3 แล้ว isp มากที่สุดคืออะไร", expectRoute: "evidence" },
    { id: "E04", kind: "EVI", uiMode: "officer", message: "เมื่อวานนี้ขอ breakdown ตาม ISP และบอก ISP มากที่สุด", expectRoute: "evidence" },
    { id: "E05", kind: "EVI", uiMode: "officer", message: "หลักฐานเมื่อวาน แยกตามผู้ให้บริการ (ISP) มากที่สุด", expectRoute: "evidence" },
    { id: "E06", kind: "EVI", uiMode: "officer", message: "เมื่อวาน แยกตาม ISP สูงสุดคืออะไร", expectRoute: "evidence" },
    { id: "E07", kind: "EVI", uiMode: "officer", message: "ช่วยสรุปเมื่อวาน แยกตาม isp และบอกมากที่สุด", expectRoute: "evidence" },
    { id: "E08", kind: "EVI", uiMode: "officer", message: "เมื่อวานนี้ ISP มากที่สุดกี่รายการ", expectRoute: "evidence" },
    { id: "E09", kind: "EVI", uiMode: "officer", message: "yesterday ISP most", expectRoute: "evidence" },
    { id: "E10", kind: "EVI", uiMode: "officer", message: "ขอ top ISP เมื่อวาน + ISP มากที่สุด", expectRoute: "evidence" },
  ];

  await waitForHealth(baseUrl, 12_000);

  const results: CaseResult[] = [];

  for (const c of cases) {
    const cid = `${cidBase}-${c.id}`;
    const uiMode = c.uiMode || "auto";

    const failures: string[] = [];
    const { status, json, raw, durMs } = await postChat(baseUrl, cid, c.message, uiMode);

    const text = String(json?.text || "");
    const sc = json?.structuredContent;
    const meta = parseRenderMeta(sc);

    assertTrue(status === 200, `HTTP status expected 200 (got ${status})`, failures);
    assertTrue(Boolean(json && typeof json === "object"), "Response JSON missing", failures);
    assertTrue(Boolean(text && text.trim().length > 0), "text missing", failures);
    assertTrue(containsThai(text), "text must contain Thai characters", failures);

    // Common forbidden tokens
    for (const re of forbidden) {
      if (re.test(text)) failures.push(`forbidden token matched: ${re}`);
    }

    // Render meta checks
    assertTrue(Boolean(meta), "structuredContent.__render missing", failures);
    if (meta) {
      assertTrue(meta.route === c.expectRoute, `route mismatch (got ${meta.route})`, failures);
      assertTrue(meta.routeDecider === "deterministic", `routeDecider mismatch (got ${meta.routeDecider})`, failures);
      assertTrue(meta.llmUsed === false, `llmUsed must be false (got ${String(meta.llmUsed)})`, failures);
      assertTrue(String(meta.version || "").startsWith("phase8"), `version must start with phase8 (got ${meta.version})`, failures);
    }

    if (c.kind === "GEO") {
      const isAmb = geoLooksAmbiguous(text);
      const isOk = geoLooksResolved(text);
      assertTrue(isAmb || isOk, "GEO must be resolved OR AMBIGUOUS Top3+question", failures);
      if (isAmb) {
        assertTrue(geoQuestionNonTrivia(text), "GEO ambiguity follow-up question must request admin info", failures);
      }
    }

    if (c.kind === "WX2") {
      // Require 2 sections based on known pairs in test cases
      const pairs: Array<[string, string]> = [
        ["หลักสี่", "ลาดกระบัง"],
        ["บางรัก", "ปทุมวัน"],
        ["บางรัก", "จตุจักร"],
        ["ปทุมวัน", "จตุจักร"],
      ];
      const matched = pairs.find(([a, b]) => c.message.includes(a) && c.message.includes(b)) || pairs.find(([a, b]) => (a === "หลักสี่" && b === "ลาดกระบัง"));
      const a = matched?.[0] || "หลักสี่";
      const b = matched?.[1] || "ลาดกระบัง";
      assertTrue(/ช่วงเวลา\s*:/i.test(text), "WX must include ช่วงเวลา:", failures);
      assertTrue(wxHasTwoSections(text, a, b), `WX must include two sections: เขต${a} + เขต${b}`, failures);
    }

    if (c.kind === "EVI") {
      if (isEvidenceIspYesterday(c.message)) {
        assertTrue(evidenceHasIspMostOrErr(text), "EVI yesterday+ISP must contain ISP+มากที่สุด OR ERR:CODE", failures);
      }
    }

    results.push({
      id: c.id,
      message: c.message,
      uiMode,
      kind: c.kind,
      expectRoute: c.expectRoute,
      status,
      durMs,
      ok: failures.length === 0,
      failures,
      route: meta?.route,
      llmUsed: meta?.llmUsed,
      routeDecider: meta?.routeDecider,
      version: meta?.version,
      textPreview: summarizeText(text),
    });

    // Small pacing to keep logs readable
    await sleep(30);
  }

  // Close child
  child.kill();

  // Write evidence files
  const parsedTrace = traceLines
    .map(parseTraceLine)
    .filter(Boolean)
    .map((x) => x as any);

  fs.writeFileSync(evidenceTraceFile, traceLines.join("\n") + "\n", "utf8");
  fs.writeFileSync(
    evidenceJsonFile,
    JSON.stringify(
      {
        ok: results.every((r) => r.ok),
        total: results.length,
        pass: results.filter((r) => r.ok).length,
        fail: results.filter((r) => !r.ok).length,
        evidence: {
          tracev3: path.basename(evidenceTraceFile),
          json: path.basename(evidenceJsonFile),
          out: path.basename(evidenceOutFile),
        },
        results,
        tracePreview: parsedTrace.slice(-40),
      },
      null,
      2
    ),
    "utf8"
  );

  const summaryLines: string[] = [];
  summaryLines.push(`PHASE82 total=${results.length} pass=${results.filter((r) => r.ok).length} fail=${results.filter((r) => !r.ok).length}`);
  for (const r of results.filter((x) => !x.ok)) {
    summaryLines.push(`- FAIL ${r.id} kind=${r.kind} route=${r.route || "?"} :: ${r.failures.join(" | ")}`);
    summaryLines.push(`  text='${r.textPreview}'`);
  }
  summaryLines.push(`TRACE=${path.basename(evidenceTraceFile)}`);
  summaryLines.push(`JSON=${path.basename(evidenceJsonFile)}`);
  summaryLines.push(`OUT=${path.basename(evidenceOutFile)}`);

  fs.writeFileSync(evidenceOutFile, summaryLines.join("\n") + "\n", "utf8");

  // Console output (for CI / local dev)
  console.log(summaryLines.join("\n"));

  if (!results.every((r) => r.ok)) {
    process.exitCode = 1;
  }
}

run().catch((e) => {
  console.error("PHASE82 verifier crashed:", e);
  process.exitCode = 2;
});
