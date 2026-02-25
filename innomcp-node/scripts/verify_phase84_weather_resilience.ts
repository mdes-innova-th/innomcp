import http from "http";
import net from "net";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

type ChatResponse = {
  text?: string;
  error?: string;
};

function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
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

function postJson(
  port: number,
  urlPath: string,
  body: any,
  headers: Record<string, string> = {}
): Promise<{ status: number; json: any; raw: string; durMs: number }> {
  const payload = Buffer.from(JSON.stringify(body));
  const started = Date.now();

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
          resolve({ status: res.statusCode || 0, json, raw, durMs: Date.now() - started });
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function get(url: string): Promise<{ status: number; raw: string }> {
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
    req.end();
  });
}

async function waitForHealth(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await get(url);
      if (r.status >= 200 && r.status < 300) return;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Health check timeout: ${url}`);
}

function assertIncludes(haystack: string, needle: string, label: string, failures: string[]) {
  if (!haystack.includes(needle)) failures.push(`${label}: missing "${needle}"`);
}

function assertNotIncludes(haystack: string, needle: string, label: string, failures: string[]) {
  if (haystack.includes(needle)) failures.push(`${label}: must not include "${needle}"`);
}

function findNewestLogFile(dir: string, prefix: string): string | null {
  try {
    const files = fs.readdirSync(dir)
      .filter((f) => f.startsWith(prefix) && f.endsWith(".log"))
      .map((f) => ({ f, p: path.join(dir, f), m: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.m - a.m);
    return files[0]?.p || null;
  } catch {
    return null;
  }
}

async function waitForMcpClientConnected(mcpClient: any, timeoutMs: number): Promise<void> {
  if (!mcpClient) throw new Error("mcpClient not available");

  const isConnected = () => {
    try {
      const arr = mcpClient.getConnectedClients?.();
      return Array.isArray(arr) && arr.length > 0;
    } catch {
      return false;
    }
  };

  if (isConnected()) return;

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => {
      cleanup();
      reject(new Error("timeout waiting for MCP client connection"));
    }, timeoutMs);

    const onAny = () => {
      if (!isConnected()) return;
      cleanup();
      resolve();
    };

    const cleanup = () => {
      clearTimeout(t);
      try { mcpClient.removeListener?.("clientConnected", onAny); } catch {}
      try { mcpClient.removeListener?.("ready", onAny); } catch {}
      try { mcpClient.removeListener?.("reconnected", onAny); } catch {}
    };

    try { mcpClient.on?.("clientConnected", onAny); } catch {}
    try { mcpClient.on?.("ready", onAny); } catch {}
    try { mcpClient.on?.("reconnected", onAny); } catch {}
  });
}

async function main() {
  // Deterministic evidence mode
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  process.env.SMOKE_MODE = "1";
  process.env.SERVER_HOST = "127.0.0.1";

  // Trace v3 evidence
  process.env.CHAT_TRACE_QA = "1";
  process.env.LOG_MODE = process.env.LOG_MODE || "test";

  const stamp = nowStamp();
  const evidenceDir = path.resolve(__dirname, "..", "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidenceLog = path.join(evidenceDir, `phase84-${stamp}.log`);

  const logLines: string[] = [];
  const failures: string[] = [];

  // ---------- Mapping/canonicalization checks (no network) ----------
  try {
    const { StationEngine } = await import("../src/utils/weather/engines/stationEngine");
    const engine = new StationEngine(new Map());

    const payload1 = {
      Stations: {
        Station: [
          { StationNameThai: "เมืองเชียงราย", Province: "จังหวัดเชียงราย" },
        ],
      },
    };

    const r1 = (engine as any).extractStations(payload1, "เชียงราย");
    if (!r1 || !Array.isArray(r1.filtered) || r1.filtered.length !== 1) {
      failures.push("MAP1: should match จังหวัดเชียงราย -> เชียงราย");
    }

    const payload2 = {
      Stations: {
        Station: [
          { StationNameThai: "ดอนเมือง", Province: "กทม" },
        ],
      },
    };

    const r2 = (engine as any).extractStations(payload2, "กรุงเทพมหานคร");
    if (!r2 || !Array.isArray(r2.filtered) || r2.filtered.length !== 1) {
      failures.push("MAP2: should match กทม -> กรุงเทพมหานคร");
    }

    logLines.push("mapping: PASS");
  } catch (err: any) {
    failures.push(`mapping: unexpected error: ${String(err?.message || err)}`);
  }

  // ---------- Start MCP server (child process) ----------
  const mcpPort = await getFreePort();
  const mcpHealthUrl = `http://127.0.0.1:${mcpPort}/health`;
  const mcpUrl = `http://127.0.0.1:${mcpPort}/mcp`;

  const serverDir = path.resolve(__dirname, "..", "..", "innomcp-server-node");

  const mcpOut: string[] = [];
  const mcpChild = (() => {
    const env = {
      ...process.env,
      SERVER_HOST: "127.0.0.1",
      SERVER_PORT: String(mcpPort),
      SMOKE_MODE: "1",
      // Simulate slow upstream (aborted before any real fetch)
      WX_TMD_DELAY_MS: "2500",
      WX_TMD_STATION_DELAY_MS: "2500",
      LOG_MODE: process.env.LOG_MODE || "test",
    };

    if (process.platform === "win32") {
      return spawn("cmd.exe", ["/d", "/c", "npx", "ts-node", "src\\index.ts"], {
        cwd: serverDir,
        env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    }

    return spawn("npx", ["ts-node", "src/index.ts"], {
      cwd: serverDir,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
  })();

  mcpChild.stdout?.on("data", (b) => mcpOut.push(String(b)));
  mcpChild.stderr?.on("data", (b) => mcpOut.push(String(b)));

  logLines.push(`mcp: starting port=${mcpPort}`);

  try {
    await waitForHealth(mcpHealthUrl, 15_000);
    logLines.push("mcp: health ok");
  } catch (err: any) {
    failures.push(`mcp: health failed: ${String(err?.message || err)}`);
    const tail = mcpOut.join("").split(/\r?\n/).filter(Boolean).slice(-40);
    if (tail.length > 0) {
      logLines.push("MCP_STDOUT_TAIL:");
      for (const l of tail) logLines.push(l);
    }
  }

  // ---------- Start innomcp-node app (in-process) ----------
  process.env.MCPSERVER_URL = mcpUrl;
  process.env.WX_STATION_TIMEOUT_MS = "200";
  process.env.WX_FORECAST_TIMEOUT_MS = "200";
  process.env.WX_NWP_TIMEOUT_MS = "200";

  logLines.push(`env: MCPSERVER_URL=${process.env.MCPSERVER_URL}`);

  const logsDir = path.resolve(__dirname, "..", "logs");
  const preLogFile = findNewestLogFile(logsDir, "mcp-");

  const { default: app } = await import("../src/app");
  const server = http.createServer(app as any);

  const port = await new Promise<number>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") return reject(new Error("Failed to bind ephemeral port"));
      resolve(addr.port);
    });
  });

  logLines.push(`chat: server port=${port}`);

  // Wait until MCP client is connected so StationEngine can find the remote client.
  try {
    const chatMod: any = await import("../src/routes/api/chat");
    await waitForMcpClientConnected(chatMod?.mcpClient, 15_000);
    logLines.push("mcpClient: connected");
  } catch (err: any) {
    failures.push(`mcpClient: not connected: ${String(err?.message || err)}`);
  }

  try {
    const q1 = "ตอนนี้กรุงเทพฝนตกไหม";
    const r = await postJson(
      port,
      "/api/chat",
      { message: q1, messages: [] },
      { "X-Smoke-Run": "1", "X-Correlation-Id": `phase84-${stamp}-wx-timeout` }
    );

    const text = String((r.json as ChatResponse)?.text || r.raw || "");
    logLines.push(`Q1 status=${r.status} durMs=${r.durMs} text=${text.replace(/\s+/g, " ").slice(0, 220)}`);

    if (r.status !== 200) failures.push(`Q1: expected HTTP 200 got ${r.status}`);
    if (r.durMs > 1500) failures.push(`Q1: expected fast timeout path, got durMs=${r.durMs}`);

    // Must be professional + explicit token
    assertIncludes(text, "ERR:WX_TIMEOUT", "Q1", failures);
    assertNotIncludes(text, "โหมดทดสอบ", "Q1", failures);

    // Give time for any late upstream logs to appear (if cancellation is broken)
    await new Promise((rr) => setTimeout(rr, 2200));

    const joinedMcp = mcpOut.join("");

    // Expect abort logs (not late status logs with bodySnippet)
    assertIncludes(joinedMcp, "TMD API aborted", "MCP", failures);
    assertNotIncludes(joinedMcp, "bodySnippet", "MCP", failures);

    // Keep small tail for evidence
    const tail = joinedMcp.split(/\r?\n/).filter(Boolean).slice(-40);
    if (tail.length > 0) {
      logLines.push("MCP_STDOUT_TAIL_POST:");
      for (const l of tail) logLines.push(l);
    }

  } finally {
    // Best-effort: stop background health checks/timers
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

    // Stop MCP child
    try {
      mcpChild.kill();
    } catch {
      // ignore
    }
  }

  // ---------- Trace v3 evidence extraction ----------
  try {
    const postLogFile = findNewestLogFile(logsDir, "mcp-");
    const picked = postLogFile && postLogFile !== preLogFile ? postLogFile : postLogFile;
    if (picked && fs.existsSync(picked)) {
      const raw = fs.readFileSync(picked, "utf8");
      const traceLines = raw
        .split(/\r?\n/)
        .filter((l) => l.includes("[ChatTrace]"))
        .slice(-20);

      logLines.push("TRACE_V3:");
      for (const l of traceLines) logLines.push(l);
    } else {
      logLines.push("TRACE_V3: (no log file found)");
    }
  } catch (err: any) {
    logLines.push(`TRACE_V3: (failed to extract) ${String(err?.message || err)}`);
  }

  const ok = failures.length === 0;
  logLines.push(ok ? "RESULT: PASS" : "RESULT: FAIL");
  if (!ok) {
    logLines.push("FAILURES:");
    for (const f of failures) logLines.push("- " + f);
  }

  fs.writeFileSync(evidenceLog, logLines.join("\n") + "\n", "utf8");
  console.log(`evidence: ${evidenceLog}`);
  if (!ok) console.error(logLines.join("\n"));
  process.exitCode = ok ? 0 : 1;

  // Some modules started during app import may keep handles alive.
  // Force-exit after a short grace period to keep verifier deterministic on Windows.
  const t = setTimeout(() => process.exit(process.exitCode || 0), 350);
  // @ts-ignore
  if (typeof (t as any).unref === "function") (t as any).unref();
}

main().catch((err) => {
  console.error("verify_phase84_weather_resilience failed:", err);
  process.exitCode = 1;
});
