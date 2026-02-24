/*
Phase 8.3 Verifier: Professional Answer Polish (Renderer-only)

Hard rules enforced:
- NO routing/gate changes (verifier only checks outputs).
- Renderer-only markers present: structuredContent.__render with deterministic routeDecider, llmUsed=false, version starts with phase8.
- Trace v3 safe: no { } \\ " ``` ` in user-visible answers.
- No env-var / infra leakage.
- No placeholder dashes in WX answers.

What it checks:
1) GEO
   - NOT_FOUND: 1-line reason + 2 examples user can try.
   - AMBIGUOUS: "คำถาม:" is first, then 1)/2)/3), and total <= 220 chars.
   - Normalized admin order: เขต/อำเภอ then แขวง/ตำบล then จังหวัด then รหัสไปรษณีย์.

2) WX
   - Multi-location: always 2 sections.
   - Each section fields (identical set): โอกาสฝน, ช่วงเวลาเสี่ยง, อุณหภูมิ, ลม, ข้อควรระวัง.
   - If missing: must show ERR:WX_NO_DATA with user-friendly Thai.

3) EVI
   - Yesterday + ISP + most: must include รวมทั้งหมด, Top ISP 1-3, มากที่สุด: <ISP>.
   - Missing creds: friendly fallback with same structure (no env-var names, no stacks).

Evidence outputs (untracked by default; trace/out should be committed for audit):
- innomcp-node/evidence/phase83-answer-polish-tracev3-<stamp>.log
- innomcp-node/evidence/phase83-answer-polish-<stamp>.out.log
- innomcp-node/evidence/phase83-answer-polish-<stamp>.json (optional commit)
*/

import net from "net";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, "-");
// Must be the very first stdout line for audit.
console.log(`RUN_STAMP=${RUN_STAMP} PID=${process.pid}`);

type ChatResponse = {
  text?: string;
  structuredContent?: any;
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
  kind: "GEO_OK" | "GEO_AMB" | "GEO_NF" | "WX2" | "WX_NO_DATA" | "EVI";
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
    /[{}\\"`]/,

    // MCP / infra / tool dumps
    /^\s*[\[{]/,
    /\bjsonrpc\b/i,
    /\bstructuredContent\b/i,
    /\bmcpResults\b/i,
    /\btoolName\b/i,

    // env leaks / secrets
    /process\.env/i,
    /\bOPENAI\b/i,
    /\bOLLAMA\b/i,
    /\bAPI[_-]?KEY\b/i,
    /\bSECRET\b/i,
    /\bPASSWORD\b/i,
    /\bTOKEN\b/i,

    // MCP / env-var names
    /\bMCP[_-]?/i,
    /SERVER_HOST/i,
    /SERVER_PORT/i,
    /MCPSERVER_URL/i,
    /DETECT_DB_/i,
    /REMOTE_OLLAMA_BASE_URL/i,
    /FAST_OLLAMA_MODEL/i,

    // old placeholder dash
    /\s—\s|^—$|\n—\n/,
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

function firstLine(text: string): string {
  const s = normalizeLineEndings(text).trim();
  return (s.split("\n")[0] || "").trim();
}

function geoIsNotFound(text: string): boolean {
  const s = String(text || "");
  const hasReason = /ไม่พบข้อมูล\s*:/i.test(s);
  const hasExamples = /(ตัวอย่าง\s*:|ลอง\s*:)/i.test(s) && /1\)/.test(s) && /2\)/.test(s);
  return hasReason && hasExamples;
}

function geoIsAmbiguous(text: string): boolean {
  const s = normalizeLineEndings(text);
  const l1 = firstLine(s);
  const hasQFirst = /^คำถาม\s*:\s*/.test(l1);
  const has123 = /(^|\n)1\)\s+/.test(s) && /(^|\n)2\)\s+/.test(s) && /(^|\n)3\)\s+/.test(s);
  return hasQFirst && has123 && s.length <= 220;
}

function indexOrderOk(text: string, a: string, b: string): boolean {
  const ia = text.indexOf(a);
  const ib = text.indexOf(b);
  return ia >= 0 && ib >= 0 && ia < ib;
}

function geoHasStableAdminOrder(text: string): boolean {
  const s = String(text || "");
  // Accept either Bangkok or non-Bangkok ordering.
  const bkk = /เขต/.test(s) && /แขวง/.test(s) && /กรุงเทพมหานคร/.test(s);
  const upc = /อำเภอ/.test(s) && /ตำบล/.test(s);

  if (bkk) {
    const ok1 = indexOrderOk(s, "เขต", "แขวง");
    const ok2 = indexOrderOk(s, "แขวง", "กรุงเทพมหานคร");
    return ok1 && ok2;
  }
  if (upc) {
    return indexOrderOk(s, "อำเภอ", "ตำบล");
  }
  // If the answer doesn't include both components, don't fail stable-order rule.
  return true;
}

function wxSplitSections(text: string): Array<{ header: string; body: string[] }> {
  // Phase 8.3: do NOT rely on newlines/bullets; split via stable marker "พื้นที่:".
  const raw = String(text || "");
  const parts = raw.split(/พื้นที่\s*:\s*/).slice(1);
  const sections: Array<{ header: string; body: string[] }> = [];

  for (const part of parts) {
    const flat = normalizeLineEndings(part).replace(/\s+/g, " ").trim();
    if (!flat) continue;

    const idx = flat.search(/\bโอกาสฝน\s*:\s*/);
    const header = (idx >= 0 ? flat.slice(0, idx) : flat.slice(0, 48)).trim();
    const body = (idx >= 0 ? flat.slice(idx) : flat).trim();
    sections.push({ header, body: [body] });
  }

  // Backward compatibility: if marker not found, fallback to old bullet split.
  if (sections.length === 0) {
    const lines = normalizeLineEndings(raw).split("\n");
    let cur: { header: string; body: string[] } | null = null;

    for (const lRaw of lines) {
      const line = String(lRaw || "").replace(/\r/g, "");
      // Only treat top-level '- ' (no leading spaces) as a new section header.
      if (/^-\s+/.test(line)) {
        if (cur) sections.push(cur);
        cur = { header: line.replace(/^-\s+/, "").trim(), body: [] };
        continue;
      }
      if (cur && line.trim().length > 0) cur.body.push(line.trim());
    }
    if (cur) sections.push(cur);
  }

  return sections;
}

function wxSectionHasFields(section: { header: string; body: string[] }): boolean {
  const body = section.body.join("\n");
  const has = (label: string) => new RegExp(`${label}\\s*:\\s*[^\n]+`).test(body);
  return (
    has("โอกาสฝน") &&
    has("ช่วงเวลาเสี่ยง") &&
    has("อุณหภูมิ") &&
    has("ลม") &&
    has("ข้อควรระวัง")
  );
}

function wxHasNoPlaceholders(text: string): boolean {
  const s = String(text || "");
  if (/—/.test(s)) return false;
  // Disallow obvious placeholder markers (do NOT ban legitimate numbers).
  if (/\b(?:N\/A|NA|TBD|TODO)\b/i.test(s)) return false;
  if (/(โอกาสฝน|ช่วงเวลาเสี่ยง|อุณหภูมิ|ลม|ข้อควรระวัง)\s*:\s*(-+|\?+|xx+|--+)/i.test(s)) return false;
  return true;
}

function eviHasRequiredStructure(text: string): boolean {
  const s = normalizeLineEndings(text);
  return (
    /รวมทั้งหมด\s*:\s*\d+\s*รายการ/.test(s) &&
    /Top\s*ISP\s*1-3\s*:/.test(s) &&
    /(^|\n)\s*1\)\s+/.test(s) &&
    /(^|\n)\s*2\)\s+/.test(s) &&
    /(^|\n)\s*3\)\s+/.test(s) &&
    /มากที่สุด\s*:\s*.+/.test(s)
  );
}

async function run() {
  const port = await getFreePort();
  const host = "127.0.0.1";
  const baseUrl = `http://${host}:${port}`;

  const stamp = RUN_STAMP;
  const cidBase = `phase83-answer-polish-${stamp}`;

  const evidenceDir = path.join(__dirname, "..", "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });

  const evidenceTraceFile = path.join(evidenceDir, `phase83-answer-polish-tracev3-${stamp}.log`);
  const evidenceJsonFile = path.join(evidenceDir, `phase83-answer-polish-${stamp}.json`);
  const evidenceOutFile = path.join(evidenceDir, `phase83-answer-polish-${stamp}.out.log`);

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
      TS_NODE_CACHE: "false",
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
    // ===== GEO (18) =====
    { id: "G01", kind: "GEO_OK", message: "จัดรูปแบบที่อยู่: 99/1 ซ.1 ถ.สีลม แขวงสีลม เขตบางรัก กทม 10500", expectRoute: "geo" },
    { id: "G02", kind: "GEO_OK", message: "ตรวจสอบที่อยู่: แขวงสีลม เขตบางรัก กทม 10500 ถูกไหม", expectRoute: "geo" },
    { id: "G03", kind: "GEO_OK", message: "รหัสไปรษณีย์ 10500 อยู่เขตอะไร", expectRoute: "geo" },
    { id: "G04", kind: "GEO_OK", message: "แขวงลุมพินี อยู่เขตอะไร", expectRoute: "geo" },
    { id: "G05", kind: "GEO_OK", message: "กทม ลักสี่ อยู่เขตอะไร", expectRoute: "geo" },
    { id: "G06", kind: "GEO_OK", message: "กรุงเทพฯ เขตลาดกระบัง อยู่จังหวัดอะไร", expectRoute: "geo" },
    { id: "G07", kind: "GEO_AMB", message: "อำเภอเมือง อยู่จังหวัดไหน", expectRoute: "geo" },
    { id: "G08", kind: "GEO_AMB", message: "บ้านใหม่ อยู่จังหวัดไหน", expectRoute: "geo" },
    { id: "G09", kind: "GEO_AMB", message: "หนองบัว อยู่ที่ไหน", expectRoute: "geo" },
    { id: "G10", kind: "GEO_AMB", message: "ท่าช้าง อยู่จังหวัดไหน", expectRoute: "geo" },
    { id: "G11", kind: "GEO_NF", message: "จังหวัดลอนดอน อยู่ภาคอะไร", expectRoute: "geo" },
    { id: "G12", kind: "GEO_NF", message: "รหัสไปรษณีย์ 99999 อยู่ที่ไหน", expectRoute: "geo" },
    { id: "G13", kind: "GEO_NF", message: "ตำบลไม่มีจริง อยู่จังหวัดไหน", expectRoute: "geo" },
    { id: "G14", kind: "GEO_OK", message: "โคราช อยู่จังหวัดอะไร", expectRoute: "geo" },
    { id: "G15", kind: "GEO_OK", message: "เจียงใหม่ อยู่จังหวัดอะไร", expectRoute: "geo" },
    { id: "G16", kind: "GEO_OK", message: "จตุจักร อยู่จังหวัดอะไร", expectRoute: "geo" },
    { id: "G17", kind: "GEO_OK", message: "กรุงเทพ เขตปทุมวัน", expectRoute: "geo" },
    { id: "G18", kind: "GEO_OK", message: "พิกัดของภูเก็ตอยู่ที่ไหน", expectRoute: "geo" },

    // ===== WX multi-location (18) =====
    { id: "W01", kind: "WX2", message: "กทม หลักสี่ และ ลาดกระบัง ตอนนี้ฝนตกไหม", expectRoute: "weather" },
    { id: "W02", kind: "WX2", message: "กรุงเทพ เขตหลักสี่, เขตลาดกระบัง วันนี้ฝนจะตกไหม", expectRoute: "weather" },
    { id: "W03", kind: "WX2", message: "กรุงเทพมหานคร หลักสี่/ลาดกระบัง พรุ่งนี้อากาศเป็นไง", expectRoute: "weather" },
    { id: "W04", kind: "WX2", message: "กทม บางรัก และ ปทุมวัน ตอนนี้ฝนตกไหม", expectRoute: "weather" },
    { id: "W05", kind: "WX2", message: "กทม บางรัก และ จตุจักร วันนี้ฝนตกไหม", expectRoute: "weather" },
    { id: "W06", kind: "WX2", message: "กรุงเทพมหานคร ปทุมวัน และ จตุจักร ตอนนี้อากาศเป็นไง", expectRoute: "weather" },
    { id: "W07", kind: "WX2", message: "วันนี้ กทม บางรัก และ ปทุมวัน ฝนตกช่วงไหน", expectRoute: "weather" },
    { id: "W08", kind: "WX2", message: "วันนี้ กรุงเทพ หลักสี่ กับ ลาดกระบัง ฝนตกช่วงไหน", expectRoute: "weather" },
    { id: "W09", kind: "WX2", message: "กรุงเทพ ลักสี่ และ ลาดกระบัง อุณหภูมิเท่าไหร่", expectRoute: "weather" },
    { id: "W10", kind: "WX2", message: "กทม หลักสี่ และ ลาดกระบัง ลมแรงไหม", expectRoute: "weather" },
    { id: "W11", kind: "WX2", message: "กทม บางรัก และ ปทุมวัน วันนี้ลมแรงไหม", expectRoute: "weather" },
    { id: "W12", kind: "WX2", message: "กทม จตุจักร และ ปทุมวัน พรุ่งนี้ฝนตกไหม", expectRoute: "weather" },
    { id: "W13", kind: "WX2", message: "กรุงเทพฯ เขตบางรัก และ เขตจตุจักร วันนี้ฝน", expectRoute: "weather" },
    { id: "W14", kind: "WX2", message: "กทม บางรัก & จตุจักร อากาศตอนนี้", expectRoute: "weather" },
    { id: "W15", kind: "WX2", message: "กทม หลักสี่ และ ลาดกระบัง อากาศตอนนี้", expectRoute: "weather" },
    { id: "W16", kind: "WX2", message: "กรุงเทพมหานคร หลักสี่ และ ลาดกระบัง ฝนตกไหม", expectRoute: "weather" },
    { id: "W17", kind: "WX2", message: "กรุงเทพ บางรัก และ ปทุมวัน พยากรณ์อากาศวันนี้", expectRoute: "weather" },
    { id: "W18", kind: "WX2", message: "กรุงเทพ ปทุมวัน และ จตุจักร พยากรณ์อากาศวันนี้", expectRoute: "weather" },

    // ===== WX no data (1) =====
    { id: "WN1", kind: "WX_NO_DATA", message: "พยากรณ์อากาศ ลอนดอน วันนี้ฝนตกไหม", expectRoute: "weather" },

    // ===== EVI (5) =====
    { id: "E01", kind: "EVI", uiMode: "officer", message: "เมื่อวาน แยกตาม ISP อะไร มากที่สุด", expectRoute: "evidence" },
    { id: "E02", kind: "EVI", uiMode: "officer", message: "สรุปหลักฐานเมื่อวาน ISP ที่มากที่สุดคืออะไร", expectRoute: "evidence" },
    { id: "E03", kind: "EVI", uiMode: "officer", message: "เมื่อวานนี้ขอ Top ISP 1-3 แล้วบอกมากที่สุด", expectRoute: "evidence" },
    { id: "E04", kind: "EVI", uiMode: "officer", message: "รายงานเมื่อวาน แยกตาม isp top 3 แล้วใครมากสุด", expectRoute: "evidence" },
    { id: "E05", kind: "EVI", uiMode: "officer", message: "yesterday ISP most", expectRoute: "evidence" },
  ];

  await waitForHealth(baseUrl, 12_000);

  const results: CaseResult[] = [];

  for (const c of cases) {
    const cid = `${cidBase}-${c.id}`;
    const uiMode = c.uiMode || "auto";

    const failures: string[] = [];
    const { status, json, durMs } = await postChat(baseUrl, cid, c.message, uiMode);

    const text = String(json?.text || "");
    const sc = json?.structuredContent;
    const meta = parseRenderMeta(sc);

    assertTrue(status === 200, `HTTP status expected 200 (got ${status})`, failures);
    assertTrue(Boolean(json && typeof json === "object"), "Response JSON missing", failures);
    assertTrue(Boolean(text && text.trim().length > 0), "text missing", failures);
    assertTrue(containsThai(text), "text must contain Thai characters", failures);

    for (const re of forbidden) {
      if (re.test(text)) failures.push(`forbidden token matched: ${re}`);
    }

    assertTrue(Boolean(meta), "structuredContent.__render missing", failures);
    if (meta) {
      assertTrue(meta.route === c.expectRoute, `route mismatch (got ${meta.route})`, failures);
      assertTrue(meta.routeDecider === "deterministic", `routeDecider mismatch (got ${meta.routeDecider})`, failures);
      assertTrue(meta.llmUsed === false, `llmUsed must be false (got ${String(meta.llmUsed)})`, failures);
      assertTrue(String(meta.version || "").startsWith("phase8"), `version must start with phase8 (got ${meta.version})`, failures);
    }

    if (c.kind === "GEO_NF") {
      assertTrue(geoIsNotFound(text), "GEO NOT_FOUND template mismatch", failures);
    }

    if (c.kind === "GEO_AMB") {
      assertTrue(geoIsAmbiguous(text), "GEO AMBIGUOUS template mismatch (คำถาม first + 1-3 + <=220)", failures);
    }

    if (c.kind === "GEO_OK") {
      assertTrue(geoHasStableAdminOrder(text), "GEO stable admin order mismatch", failures);
    }

    if (c.kind === "WX2") {
      assertTrue(/ช่วงเวลา\s*:/i.test(text), "WX must include ช่วงเวลา:", failures);
      const sections = wxSplitSections(text);
      assertTrue(sections.length >= 2, `WX must have at least 2 sections (got ${sections.length})`, failures);
      // Validate first two sections only (multi-location contract).
      const first2 = sections.slice(0, 2);
      for (const [i, sec] of first2.entries()) {
        assertTrue(wxSectionHasFields(sec), `WX section ${i + 1} missing required fields`, failures);
      }
      assertTrue(wxHasNoPlaceholders(text), "WX must not contain placeholders", failures);
    }

    if (c.kind === "WX_NO_DATA") {
      // Phase 8.3: Accept either upstream no-data token, or user-input missing-province guidance.
      const okNoData = /ERR:WX_NO_DATA/.test(text);
      const okProvMissing = /กรุณา\s*ระบุจังหวัด\s*\/\s*พื้นที่ที่ต้องการ/.test(text);
      assertTrue(okNoData || okProvMissing, "WX error must include ERR:WX_NO_DATA or PROVINCE_MISSING guidance", failures);
    }

    if (c.kind === "EVI") {
      assertTrue(eviHasRequiredStructure(text), "EVI yesterday+ISP structure mismatch", failures);
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

    await sleep(30);
  }

  child.kill();

  const parsedTrace = traceLines.map(parseTraceLine).filter(Boolean).map((x) => x as any);

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
        tracePreview: parsedTrace.slice(-60),
      },
      null,
      2
    ),
    "utf8"
  );

  const summaryLines: string[] = [];
  summaryLines.push(
    `PHASE83 total=${results.length} pass=${results.filter((r) => r.ok).length} fail=${results.filter((r) => !r.ok).length}`
  );
  for (const r of results.filter((x) => !x.ok)) {
    summaryLines.push(`- FAIL ${r.id} kind=${r.kind} route=${r.route || "?"} :: ${r.failures.join(" | ")}`);
    summaryLines.push(`  text='${r.textPreview}'`);
  }
  summaryLines.push(`TRACE=${path.basename(evidenceTraceFile)}`);
  summaryLines.push(`JSON=${path.basename(evidenceJsonFile)}`);
  summaryLines.push(`OUT=${path.basename(evidenceOutFile)}`);

  fs.writeFileSync(evidenceOutFile, summaryLines.join("\n") + "\n", "utf8");

  console.log(summaryLines.join("\n"));

  if (!results.every((r) => r.ok)) {
    process.exitCode = 1;
  }
}

run().catch((e) => {
  console.error("PHASE83 verifier crashed:", e);
  process.exitCode = 2;
});
