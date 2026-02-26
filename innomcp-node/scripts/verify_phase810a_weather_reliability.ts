import http from "http";
import net from "net";
import fs from "fs";
import path from "path";
import { spawn, spawnSync } from "child_process";

function isoStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function getFreePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const s = net.createServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      if (!addr || typeof addr === "string") return reject(new Error("Failed to bind free port"));
      const port = addr.port;
      s.close(() => resolve(port));
    });
  });
}

function get(url: string, timeoutMs = 5000): Promise<{ status: number; raw: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      { host: u.hostname, port: Number(u.port), path: u.pathname + u.search, method: "GET" },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c))));
        res.on("end", () => resolve({ status: res.statusCode || 0, raw: Buffer.concat(chunks).toString("utf8") }));
      }
    );
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
    req.end();
  });
}

async function waitForHealth(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await get(url, 2000);
      if (r.status >= 200 && r.status < 300) return;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Health check timeout: ${url}`);
}

function postJson(url: string, body: any, timeoutMs = 20000): Promise<{ status: number; raw: string; durMs: number }> {
  const payload = Buffer.from(JSON.stringify(body));
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      {
        host: u.hostname,
        port: Number(u.port),
        path: u.pathname + u.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // MCP server requires text/event-stream in Accept (otherwise returns 406)
          // Backend also uses this value when calling MCP.
          Accept: "application/json, text/event-stream",
          "Content-Length": String(payload.length),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c))));
        res.on("end", () => resolve({ status: res.statusCode || 0, raw: Buffer.concat(chunks).toString("utf8"), durMs: Date.now() - started }));
      }
    );
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
    req.write(payload);
    req.end();
  });
}

function extractTextFromChatResponse(raw: string): string {
  try {
    const j = JSON.parse(raw);
    // Chat route usually returns { reply: string, ... }
    return String(j?.reply ?? j?.text ?? raw);
  } catch {
    return String(raw);
  }
}

function extractAreaBlocks(text: string): string[] {
  const lines = String(text || "").split(/\r?\n/);
  const starts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*พื้นที่\s*:/i.test(lines[i])) starts.push(i);
  }
  const blocks: string[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : lines.length;
    const b = lines.slice(start, end).join("\n").trim();
    if (b) blocks.push(b);
  }
  return blocks;
}

function hasAllFields(block: string): boolean {
  const req = [
    /^พื้นที่\s*:/m,
    /^โอกาสฝน\s*:/m,
    /^ช่วงเวลาเสี่ยง\s*:/m,
    /^อุณหภูมิ\s*:/m,
    /^ลม\s*:/m,
    /^ข้อควรระวัง\s*:/m,
  ];
  return req.every((re) => re.test(block));
}

function assertNoPlaceholders(text: string): string[] {
  const failures: string[] = [];
  const t = String(text || "");
  if (/30\s*°?C\s*70%\s*20%/i.test(t)) failures.push("placeholder combo 30°C 70% 20% found");
  if (/เพื่อการทดสอบระบบ/i.test(t)) failures.push("test placeholder phrase found");
  if (/\bโหมดทดสอบ\b/i.test(t)) failures.push("test-mode phrase found");
  return failures;
}

function assertTraceV3Safe(text: string): string[] {
  // User requested: trace v3 passes (no { } " \ `` inside a='...')
  // This verifier just checks response text for obvious forbidden chars.
  const failures: string[] = [];
  const t = String(text || "");
  const forbidden = ["{", "}", "\"", "`", "\\"];
  for (const f of forbidden) {
    if (t.includes(f)) failures.push(`found forbidden char '${f}' in answer`);
  }
  if (/```/.test(t)) failures.push("found code fence```");
  return failures;
}

function grepBannedLogLeak(allLogs: string): string[] {
  const failures: string[] = [];
  const banned = [
    { re: /\buid=/i, why: "log leak: uid=" },
    { re: /\bukey=/i, why: "log leak: ukey=" },
    { re: /requestInfo\.headers/i, why: "log leak: requestInfo.headers" },
    { re: /\bAuthorization\b/i, why: "log leak: Authorization" },
    { re: /\bBearer\b/i, why: "log leak: Bearer" },
    { re: /DETECT_DB_PASSWORD/i, why: "log leak: DETECT_DB_PASSWORD" },
    { re: /process\.env/i, why: "log leak: process.env" },
  ];
  for (const b of banned) {
    if (b.re.test(allLogs)) failures.push(b.why);
  }
  return failures;
}

function assertChatTraceV3Safe(allLogs: string): string[] {
  const failures: string[] = [];
  const lines = allLogs.split(/\r?\n/);
  for (const ln of lines) {
    if (!ln.includes("[ChatTrace]")) continue;
    const m = ln.match(/\sa='([^']*)'/);
    if (!m) continue;
    const a = m[1] || "";
    if (/[{}"`\\]/.test(a)) {
      failures.push("tracev3: forbidden char found in a='...'");
      break;
    }
    if (a.includes("```")) {
      failures.push("tracev3: code fence found in a='...'");
      break;
    }
  }
  return failures;
}

function countToolCacheHits(allLogs: string): { station3hHits: number; anyHits: number } {
  const lines = allLogs.split(/\r?\n/);
  let anyHits = 0;
  let station3hHits = 0;
  for (const ln of lines) {
    if (!ln.includes("[ToolCache]")) continue;
    if (ln.includes(" HIT:")) {
      anyHits++;
      // Accept either our verifier-friendly logs or the existing ToolCache util logs.
      if (/tool=tmd_weather_3hours_all_stations/i.test(ln) || /\bHIT:\s*tmd_weather_3hours_all_stations\b/i.test(ln)) {
        station3hHits++;
      }
    }
  }
  return { station3hHits, anyHits };
}

function looksLikeMarkdownTable(text: string): boolean {
  const t = String(text || "");
  // In trace-v3 / single-line answers, the table often appears inline:
  // "ตารางสรุปสภาพอากาศ: | เวลา | ... | จังหวัด | ..."
  // So accept either multi-line markdown table or inline table-with-pipes.
  if (!/\|/.test(t)) return false;
  if (!/จังหวัด/.test(t)) return false;
  if (!/(เวลา|สถานี|อุณหภูมิ|RH|ฝน|ลม)/.test(t)) return false;
  // Needs at least a few cells.
  const pipeCount = (t.match(/\|/g) || []).length;
  if (pipeCount < 6) return false;
  return true;
}

function postJsonAbortAfter(url: string, body: any, abortAfterMs: number): Promise<void> {
  const payload = Buffer.from(JSON.stringify(body));
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = http.request(
      {
        host: u.hostname,
        port: Number(u.port),
        path: u.pathname + u.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/plain, */*",
          "Content-Length": String(payload.length),
        },
      },
      () => {
        // ignore response
      }
    );
    const t = setTimeout(() => {
      try {
        req.destroy(new Error("abort"));
      } catch {
        // ignore
      }
      resolve();
    }, abortAfterMs);

    req.on("error", () => {
      clearTimeout(t);
      resolve();
    });
    req.write(payload);
    req.end();
  });
}

function killProcessTree(pid: number | undefined): void {
  if (!pid || pid <= 0) return;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
      return;
    }
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      process.kill(pid, "SIGKILL");
    }
  } catch {
    // ignore
  }
}

function tryReadLatestLogFile(dirPath: string, namePrefix: string): string {
  try {
    const items = fs
      .readdirSync(dirPath)
      .filter((n) => n.startsWith(namePrefix) && n.endsWith(".log"))
      .map((name) => {
        const fullPath = path.join(dirPath, name);
        const st = fs.statSync(fullPath);
        return { name, fullPath, mtimeMs: st.mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    if (items.length === 0) return "";
    return fs.readFileSync(items[0].fullPath, "utf8");
  } catch {
    return "";
  }
}

type CaseSpec = {
  name: string;
  message: string;
  timeoutMs?: number;
  expectBlocksAtLeast?: number;
  allowEmptyBlocks?: boolean;
  repeat?: number;
};

async function main() {
  const stamp = isoStamp();
  const evidenceDir = path.resolve(__dirname, "..", "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });

  const evidenceFile = path.resolve(evidenceDir, `phase810a-weather-reliability-${stamp}.log`);
  const out: string[] = [];

  const mcpPort = await getFreePort();
  const bePort = await getFreePort();

  const repoRoot = path.resolve(__dirname, "..", "..");
  const mcpDir = path.resolve(repoRoot, "innomcp-server-node");
  const beDir = path.resolve(repoRoot, "innomcp-node");

  const mcpOut: string[] = [];
  const beOut: string[] = [];

  const spawnTsNode = (cwd: string, entryWin: string, entryPosix: string, env: Record<string, string>) => {
    if (process.platform === "win32") {
      return spawn("cmd.exe", ["/d", "/c", "npx", "ts-node", entryWin], {
        cwd,
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    }
    return spawn("npx", ["ts-node", entryPosix], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
  };

  const mcpChild = spawnTsNode(
    mcpDir,
    "src\\index.ts",
    "src/index.ts",
    {
      SERVER_HOST: "127.0.0.1",
      SERVER_PORT: String(mcpPort),
      SMOKE_MODE: "1",
      LOG_MODE: process.env.LOG_MODE || "test",
      // keep upstream fast/deterministic
      WX_TMD_DELAY_MS: process.env.WX_TMD_DELAY_MS || "0",
      // Deterministic abort for verifier: short fetch timeout (SMOKE-only) and no artificial delay.
      WX_TMD_STATION_DELAY_MS: process.env.WX_TMD_STATION_DELAY_MS || "0",
      WX_TMD_TIMEOUT_MS: process.env.WX_TMD_TIMEOUT_MS || "50",
    }
  );
  mcpChild.stdout?.on("data", (b) => mcpOut.push(String(b)));
  mcpChild.stderr?.on("data", (b) => mcpOut.push(String(b)));

  const beChild = spawnTsNode(
    beDir,
    "src\\index.ts",
    "src/index.ts",
    {
      SERVER_HOST: "127.0.0.1",
      SERVER_PORT: String(bePort),
      SMOKE_MODE: "1",
      LOG_MODE: process.env.LOG_MODE || "test",
      MCPSERVER_URL: `http://127.0.0.1:${mcpPort}/mcp`,
      // Deterministic fixtures to avoid real upstream; still exercises caching layers.
      WEATHER_FIXTURE_W1: "1",
      CHAT_TRACE_QA: "1",
      // Allow ToolCache log lines (otherwise chat trace mode suppresses non-[ChatTrace])
      LOG_DEBUG: "1",
      // Deterministic station filter=0 for one province
      WX_FORCE_STATION_FILTER_ZERO_FOR: "ภูเก็ต",
    }
  );
  beChild.stdout?.on("data", (b) => beOut.push(String(b)));
  beChild.stderr?.on("data", (b) => beOut.push(String(b)));

  const mcpHealth = `http://127.0.0.1:${mcpPort}/health`;
  const beHealth = `http://127.0.0.1:${bePort}/health`;

  const failures: string[] = [];
  const caseSummaries: string[] = [];

  try {
    out.push(`# PHASE 8.10A Weather Reliability Verifier`);
    out.push(`stamp=${stamp}`);
    out.push(`mcpPort=${mcpPort} bePort=${bePort}`);

    await waitForHealth(mcpHealth, 25_000);
    await waitForHealth(beHealth, 25_000);

    const chatUrl = `http://127.0.0.1:${bePort}/api/chat`;

    const cases: CaseSpec[] = [
      { name: "bkk-laksi-detailed", message: "ตอนนี้ กทม เขตหลักสี่ ฝนตกไหม ขอรายละเอียด", expectBlocksAtLeast: 1 },
      // repeat twice to force ToolCache HIT for station tool
      { name: "bkk-laksi-repeat-1", message: "ตอนนี้ กทม เขตหลักสี่ ฝนตกไหม ขอรายละเอียด", expectBlocksAtLeast: 1 },
      { name: "bkk-multi-laksi-lkb", message: "กทม เขตหลักสี่ และลาดกระบัง ฝนตกไหม บอกละเอียด", expectBlocksAtLeast: 2 },
      { name: "sisaket-now", message: "ศรีสะเกษ ตอนนี้ฝนตกไหม", expectBlocksAtLeast: 1 },
      { name: "multi-province-table", message: "ขอเป็นตารางฝน 4 จังหวัด: กรุงเทพ เชียงราย ศรีสะเกษ ภูเก็ต", expectBlocksAtLeast: 0, allowEmptyBlocks: true },
      // Station filter=0 case (should not crash; should be operator-grade)
      { name: "station-filter-zero", message: "ภูเก็ต ตอนนี้ฝนตกไหม ขอรายละเอียด", expectBlocksAtLeast: 1 },
    ];

    for (const c of cases) {
      const t0 = Date.now();
      let status = 0;
      let replyText = "";
      let errorText: string | null = null;

      try {
        const r = await postJson(
          chatUrl,
          {
            message: c.message,
            // align with existing chat API usage
            uiMode: "auto",
          },
          c.timeoutMs ?? 20_000
        );
        status = r.status;
        replyText = extractTextFromChatResponse(r.raw);
      } catch (e: any) {
        errorText = String(e?.message ?? e);
      }

      const durMs = Date.now() - t0;

      const blocks = extractAreaBlocks(replyText);
      const errs: string[] = [];

      if (!errorText) {
        if (c.name === "multi-province-table") {
          // Table mode is expected to return a markdown table, not area blocks.
          if (!looksLikeMarkdownTable(replyText)) {
            errs.push("expected a markdown weather table output, but not found");
          }
        } else {
          if (typeof c.expectBlocksAtLeast === "number" && blocks.length < c.expectBlocksAtLeast) {
            errs.push(`expected >=${c.expectBlocksAtLeast} area blocks, got ${blocks.length}`);
          }
          for (const b of blocks) {
            if (!hasAllFields(b)) errs.push("missing required 5-field contract in an area block");
          }
        }
        errs.push(...assertNoPlaceholders(replyText));
        errs.push(...assertTraceV3Safe(replyText));
      }

      const ok = !errorText && errs.length === 0;
      if (!ok) {
        failures.push(`${c.name}: ${errorText ? `http_error=${errorText}` : errs.join("; ")}`);
      }

      caseSummaries.push(
        `[CASE] name=${c.name} ok=${ok ? "PASS" : "FAIL"} status=${status} ms=${durMs} blocks=${blocks.length}`
      );
    }

    // Exercise key-safe logging deterministically: call a TMD tool and abort quickly.
    // We validate via structuredContent (more deterministic than scraping logs).
    let mcpToolCallRaw: string | null = null;
    try {
      const r = await postJson(
        `http://127.0.0.1:${mcpPort}/mcp`,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "tmd_weather_3hours_all_stations", arguments: {} },
        },
        8000
      );
      mcpToolCallRaw = r.raw;
    } catch {
      // ignore
    }

    // Give the MCP process a moment to flush the GET/abort logs.
    await new Promise((r) => setTimeout(r, 500));

    const mcpProjectLog = tryReadLatestLogFile(path.resolve(mcpDir, "logs"), "mcp-server-");
    // Log hygiene & cache checks (from captured process logs + MCP log file)
    const allLogs = [
      "--- MCP(logfile) ---",
      mcpProjectLog,
      "--- MCP(stdout) ---",
      ...mcpOut,
      "--- BACKEND ---",
      ...beOut,
    ].join("\n");

    const leakFindings = grepBannedLogLeak(allLogs);
    if (leakFindings.length > 0) {
      failures.push(...leakFindings.map((s) => `log_hygiene: ${s}`));
    }

    const traceFindings = assertChatTraceV3Safe(allLogs);
    if (traceFindings.length > 0) {
      failures.push(...traceFindings);
    }

    const hits = countToolCacheHits(allLogs);
    if (hits.station3hHits < 1) {
      failures.push(`expected >=1 ToolCache HIT for tmd_weather_3hours_all_stations, got ${hits.station3hHits}`);
    }

    // Ensure tmdTools returns safe meta (url redacted) + auth marker + deterministic abort.
    try {
      const parsed = mcpToolCallRaw ? JSON.parse(mcpToolCallRaw) : null;
      const sc = parsed?.result?.structuredContent;
      const meta = sc?.meta;
      if (!meta || typeof meta !== "object") failures.push("mcp_call: missing structuredContent.meta");
      else {
        if (typeof meta.authParamsPresent !== "boolean") failures.push("mcp_call: authParamsPresent missing/invalid");
        const safeUrl = String(meta.url || "");
        if (!safeUrl) failures.push("mcp_call: meta.url missing");
        if (/\b(uid|ukey)=/i.test(safeUrl)) failures.push("mcp_call: meta.url leaked uid/ukey");
      }
      const err = String(sc?.error || "");
      if (!/TMD API aborted/i.test(err)) failures.push("mcp_call: expected error 'TMD API aborted'");
    } catch {
      failures.push("mcp_call: failed to parse tools/call response JSON");
    }

    const passCount = caseSummaries.filter((l) => l.includes("ok=PASS")).length;
    const totalCount = caseSummaries.length;

    out.push(`RESULT: ${failures.length === 0 ? "PASS" : "FAIL"}`);
    out.push(`PASS_COUNT: ${passCount}/${totalCount}`);
    out.push("");
    out.push("## Cases");
    out.push(...caseSummaries);
    out.push("");
    out.push("## Cache");
    out.push(`ToolCache HIT (station3h) = ${hits.station3hHits}`);
    out.push(`ToolCache HIT (any) = ${hits.anyHits}`);
    out.push("");
    out.push("## Grep Summary");
    out.push(`uid= present? ${/\buid=/i.test(allLogs) ? "YES (FAIL)" : "NO"}`);
    out.push(`ukey= present? ${/\bukey=/i.test(allLogs) ? "YES (FAIL)" : "NO"}`);
    out.push(`Authorization present? ${/\bAuthorization\b/i.test(allLogs) ? "YES (FAIL)" : "NO"}`);
    out.push(`Bearer present? ${/\bBearer\b/i.test(allLogs) ? "YES (FAIL)" : "NO"}`);
    out.push(`requestInfo.headers present? ${/requestInfo\.headers/i.test(allLogs) ? "YES (FAIL)" : "NO"}`);
    out.push(`process.env present? ${/process\.env/i.test(allLogs) ? "YES (FAIL)" : "NO"}`);
    out.push("");

    if (failures.length > 0) {
      out.push("## Failures");
      out.push(...failures.map((f) => `- ${f}`));
      out.push("");
    }

    // Include a small tail of logs for debugging (still must be key-safe)
    const tail = allLogs
      .split(/\r?\n/)
      .slice(-120)
      .join("\n");
    out.push("## Log Tail (last 120 lines)");
    out.push(tail);

    fs.writeFileSync(evidenceFile, out.join("\n"), "utf8");

    // Always exit non-zero on FAIL so CI/runner can detect.
    if (failures.length > 0) process.exitCode = 1;
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    out.push(`RESULT: BLOCKED`);
    out.push(`ROOT_CAUSE: ${msg}`);
    fs.writeFileSync(evidenceFile, out.join("\n"), "utf8");
    process.exitCode = 2;
  } finally {
    killProcessTree(beChild.pid);
    killProcessTree(mcpChild.pid);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(2);
});
