import http from "http";
import net from "net";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

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

function postJsonKeepAlive(
  port: number,
  urlPath: string,
  body: any,
  agent: http.Agent
): Promise<{ status: number; raw: string; durMs: number }> {
  const payload = Buffer.from(JSON.stringify(body));
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: urlPath,
        method: "POST",
        agent,
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
          resolve({ status: res.statusCode || 0, raw, durMs: Date.now() - started });
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function assertEq(actual: any, expected: any, label: string, failures: string[]) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) failures.push(`${label}: expected=${e} actual=${a}`);
}

function assertTrue(cond: any, label: string, failures: string[]) {
  if (!cond) failures.push(label);
}

function parseCompletedDurations(lines: string[]): number[] {
  const out: number[] = [];
  for (const ln of lines) {
    // Example: [⏱️  123ms] MCP Request completed: tools/list
    const m = ln.match(/\[⏱️\s+\s*(\d+)ms\]\s+MCP Request completed:/);
    if (m?.[1]) out.push(Number(m[1]));
  }
  return out;
}

async function main() {
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  process.env.SMOKE_MODE = "1";
  process.env.LOG_MODE = process.env.LOG_MODE || "test";

  const stamp = nowStamp();
  const evidenceDir = path.resolve(__dirname, "..", "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidenceLog = path.join(evidenceDir, `phase85-${stamp}.log`);

  const logLines: string[] = [];
  const failures: string[] = [];

  // --- (1) Province resolver hardening (<=6 cases) ---
  try {
    const { resolveProvinces } = await import("../src/utils/locationResolver");

    assertEq(resolveProvinces("เขตบางเขน"), ["กรุงเทพมหานคร"], "RES1(bkk-district)", failures);
    assertEq(resolveProvinces("แขวงปทุมวัน"), ["กรุงเทพมหานคร"], "RES2(bkk-khwaeng)", failures);
    assertEq(resolveProvinces("กรุงเทพฯ"), ["กรุงเทพมหานคร"], "RES3(bkk-abbrev)", failures);

    assertEq(resolveProvinces("จ.ภูเก็ต"), ["ภูเก็ต"], "RES4(province-abbrev)", failures);
    assertEq(resolveProvinces("ไปเชียงใหม่"), ["เชียงใหม่"], "RES5(province-thai)", failures);
    assertEq(resolveProvinces("korat"), ["นครราชสีมา"], "RES6(province-alias)", failures);

    logLines.push("resolver: PASS");
  } catch (err: any) {
    failures.push(`resolver: unexpected error: ${String(err?.message || err)}`);
  }

  // --- (2) Cancel/Timing accounting: no late completion >60s ---
  // Repro is deterministic by keeping a socket open (keep-alive) and closing it after >60s.
  const mcpPort = await getFreePort();
  const mcpHealthUrl = `http://127.0.0.1:${mcpPort}/health`;

  const serverDir = path.resolve(__dirname, "..", "..", "innomcp-server-node");
  const mcpOut: string[] = [];

  const mcpChild = (() => {
    const env = {
      ...process.env,
      SERVER_HOST: "127.0.0.1",
      SERVER_PORT: String(mcpPort),
      SMOKE_MODE: "1",
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

  try {
    await waitForHealth(mcpHealthUrl, 15_000);

    const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });

    const reqBody = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    };

    const r = await postJsonKeepAlive(mcpPort, "/mcp", reqBody, agent);
    const rawSnippet = (r.raw || "").slice(0, 220).replace(/[\r\n]+/g, " ");
    logLines.push(`mcp.tools/list http=${r.status} durMs=${r.durMs} raw=${JSON.stringify(rawSnippet)}`);
    if (!(r.status >= 200 && r.status < 300)) {
      failures.push("MCP1: tools/list must succeed");
      agent.destroy();
      throw new Error(`tools/list failed: HTTP ${r.status}`);
    }

    // Keep socket alive >60s, then close it (this used to trigger a late "completed" log).
    await new Promise((r) => setTimeout(r, 62_000));
    agent.destroy();

    // Give the server a moment to process socket close.
    await new Promise((r) => setTimeout(r, 500));

    const joined = mcpOut.join("");
    const lines = joined.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const completedDurations = parseCompletedDurations(lines);

    // Must have at least one completion log, and none >60s.
    assertTrue(completedDurations.length >= 1, "MCP2: expected at least 1 'MCP Request completed' log", failures);
    const over60s = completedDurations.filter((d) => Number.isFinite(d) && d > 60_000);
    assertTrue(over60s.length === 0, `MCP3: must not log late completion >60s (found ${over60s.join(",")})`, failures);

    logLines.push("cancel_accounting: PASS");
  } catch (err: any) {
    failures.push(`cancel_accounting: unexpected error: ${String(err?.message || err)}`);
  } finally {
    try { mcpChild.kill(); } catch {}
  }

  // --- Write evidence ---
  const header = [
    "PHASE85_VERIFY",
    `stamp=${stamp}`,
    `result=${failures.length === 0 ? "PASS" : "FAIL"}`,
  ];

  const body = [
    ...header,
    "",
    "LOG:",
    ...logLines,
    "",
    "FAILURES:",
    ...(failures.length ? failures : ["(none)"]),
    "",
    "NOTE: MCP server output is captured in-memory for timing assertions.",
  ].join("\n");

  fs.writeFileSync(evidenceLog, body, "utf8");

  if (failures.length) {
    console.error(body);
    process.exit(1);
  }

  console.log(body);
}

main().catch((err) => {
  console.error(String(err?.stack || err));
  process.exit(1);
});
