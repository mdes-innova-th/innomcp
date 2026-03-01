import http from "http";
import net from "net";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

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
      {
        host: u.hostname,
        port: Number(u.port),
        path: u.pathname + u.search,
        method: "GET",
      },
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

function postJson(
  url: string,
  body: any,
  timeoutMs = 15000
): Promise<{ status: number; raw: string; durMs: number }> {
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
          Accept: "application/json, text/plain, */*",
          "Content-Length": String(payload.length),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c))));
        res.on("end", () => {
          resolve({ status: res.statusCode || 0, raw: Buffer.concat(chunks).toString("utf8"), durMs: Date.now() - started });
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));

    req.write(payload);
    req.end();
  });
}

function postJsonRawAbortable(
  port: number,
  urlPath: string,
  body: any,
  opts?: { destroyAfterMs?: number }
): Promise<{ status: number; raw: string; durMs: number; aborted: boolean }> {
  const payload = Buffer.from(JSON.stringify(body));
  const started = Date.now();

  return new Promise((resolve, reject) => {
    let aborted = false;
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: urlPath,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "Content-Length": String(payload.length),
          Connection: "keep-alive",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c))));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          resolve({ status: res.statusCode || 0, raw, durMs: Date.now() - started, aborted });
        });
      }
    );

    req.on("error", (e) => {
      if (aborted) return resolve({ status: 0, raw: String(e?.message || e), durMs: Date.now() - started, aborted });
      reject(e);
    });

    req.write(payload);
    req.end();

    if (opts?.destroyAfterMs && opts.destroyAfterMs > 0) {
      setTimeout(() => {
        aborted = true;
        try {
          req.destroy(new Error("client abort"));
        } catch {
          // ignore
        }
      }, opts.destroyAfterMs);
    }
  });
}

function countMatches(lines: string[], re: RegExp): number {
  let n = 0;
  for (const ln of lines) if (re.test(ln)) n++;
  return n;
}

function findFirst(lines: string[], re: RegExp): string | null {
  for (const ln of lines) {
    if (re.test(ln)) return ln;
  }
  return null;
}

function extractTmdSnippets(lines: string[]): string[] {
  const out: string[] = [];
  for (const ln of lines) {
    if (!ln.includes("[TMD:")) continue;
    const m = ln.match(/\bsnippet=([\s\S]*)$/);
    if (m && typeof m[1] === "string") out.push(m[1]);
  }
  return out;
}

async function main() {
  const stamp = isoStamp();
  const evidenceDir = path.resolve(__dirname, "..", "evidence");
  const evidenceFile = path.resolve(evidenceDir, `phase88-log-hygiene-${stamp}.log`);

  const logLines: string[] = [];
  const failures: string[] = [];

  // Start MCP server + Backend server (SMOKE_MODE=1)
  const mcpPort = await getFreePort();
  const bePort = await getFreePort();

  const mcpDir = path.resolve(__dirname, "..", "..", "innomcp-server-node");
  const beDir = path.resolve(__dirname, "..", "..", "innomcp-node");

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
      // Avoid real upstream calls: delay then verifier aborts the request.
      WX_TMD_DELAY_MS: "5000",
      WX_TMD_STATION_DELAY_MS: "5000",
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
      // Point backend at our MCP server.
      MCPSERVER_URL: `http://127.0.0.1:${mcpPort}/mcp`,
      // Keep stdout operator-grade for this verifier
      CHAT_TRACE_QA: "0",
      LOG_DEBUG: "0",
    }
  );

  beChild.stdout?.on("data", (b) => beOut.push(String(b)));
  beChild.stderr?.on("data", (b) => beOut.push(String(b)));

  const mcpHealth = `http://127.0.0.1:${mcpPort}/health`;
  const beHealth = `http://127.0.0.1:${bePort}/health`;

  try {
    await waitForHealth(mcpHealth, 20_000);
    await waitForHealth(beHealth, 20_000);

    // 2-3 WX calls via backend
    const chatUrl = `http://127.0.0.1:${bePort}/api/chat`;

    const wx1 = await postJson(chatUrl, { message: "พรุ่งนี้ หลักสี่ อากาศเป็นไง" }, 20_000);
    logLines.push(`wx1.http=${wx1.status} durMs=${wx1.durMs}`);

    const wx2 = await postJson(chatUrl, { message: "วันนี้ ลาดกระบัง ฝนตกไหม" }, 20_000);
    logLines.push(`wx2.http=${wx2.status} durMs=${wx2.durMs}`);

    const wx3 = await postJson(chatUrl, { message: "พยากรณ์อากาศ กรุงเทพฯ 7 วัน" }, 20_000);
    logLines.push(`wx3.http=${wx3.status} durMs=${wx3.durMs}`);

    // Trigger TMD tool log (abort during SMOKE delay so no real network)
    const req = {
      jsonrpc: "2.0",
      id: 8801,
      method: "tools/call",
      params: { name: "tmd_weather_3hours_all_stations", arguments: {} },
    };

    const r = await postJsonRawAbortable(mcpPort, "/mcp", req, { destroyAfterMs: 200 });
    logLines.push(`mcp.abort.http=${r.status} aborted=${r.aborted} durMs=${r.durMs}`);

    // Give processes time to flush logs
    await new Promise((r) => setTimeout(r, 800));

    const all = (mcpOut.join("") + "\n" + beOut.join("")).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

    // a) must not dump requestInfo[.]headers
    const badHeaders = findFirst(all, /requestInfo[.]headers/i);
    if (badHeaders) failures.push(`A: found requestInfo[.]headers log: ${badHeaders}`);

    // b) must not leak uid/ukey or auth-header/token-scheme
    const badUidUkey = findFirst(all, /\b(uid|ukey)[=]/i);
    if (badUidUkey) failures.push(`B1: found uid/ukey query in logs: ${badUidUkey}`);

    const badAuth = findFirst(all, /authorization\b|\bbearer\b/i);
    if (badAuth) failures.push(`B2: found auth token marker in logs: ${badAuth}`);

    // c) no giant JSON snippets from TMD responses
    const badBodySnippet = findFirst(all, /bodySnippet=/i);
    if (badBodySnippet) failures.push(`C1: found bodySnippet dumping: ${badBodySnippet}`);

    const tmdSnips = extractTmdSnippets(all);
    const tooLong = tmdSnips.find((s) => String(s).length > 200);
    if (tooLong) failures.push(`C2: found TMD snippet >200 chars (len=${String(tooLong).length})`);

    const forbiddenChars = /[{}"'`]/;
    const badChar = tmdSnips.find((s) => forbiddenChars.test(String(s)));
    if (badChar) failures.push(`C3: found forbidden chars in TMD snippet: ${String(badChar).slice(0, 80)}`);

    // args ignored line should not dump objects
    const badArgsIgnored = findFirst(all, /\[TMD:.*\]\s+args ignored:(?!\s*argsKeys=)/);
    if (badArgsIgnored) failures.push(`C4: args ignored log is not argsKeys-only: ${badArgsIgnored}`);

    logLines.push(`scan.lines=${all.length}`);
    logLines.push(`scan.tmdSnippets=${tmdSnips.length}`);

    if (failures.length === 0) {
      logLines.push("RESULT: PASS");
      fs.mkdirSync(evidenceDir, { recursive: true });
      fs.writeFileSync(evidenceFile, logLines.join("\n") + "\n", "utf8");
      console.log("RESULT: PASS");
      console.log(`evidenceFile=${evidenceFile}`);
      return;
    }

    const oneLine = failures[0] || "unknown";
    logLines.push(`BLOCKED: ${oneLine}`);
    logLines.push("RESULT: BLOCKED");
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(evidenceFile, logLines.join("\n") + "\n", "utf8");

    console.log("RESULT: BLOCKED");
    console.log(`reason=${oneLine}`);
    console.log(`evidenceFile=${evidenceFile}`);
  } catch (e: any) {
    const reason = `BLOCKED: verifier runtime error: ${String(e?.message || e)}`;
    logLines.push(reason);
    logLines.push("RESULT: BLOCKED");
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(evidenceFile, logLines.join("\n") + "\n", "utf8");

    console.log("RESULT: BLOCKED");
    console.log(`reason=${reason}`);
    console.log(`evidenceFile=${evidenceFile}`);
  } finally {
    try {
      mcpChild.kill();
    } catch {
      // ignore
    }
    try {
      beChild.kill();
    } catch {
      // ignore
    }
  }
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(1);
});
