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

function postJsonRaw(
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
          // MCP transport requires both JSON + SSE accept types.
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

function assertEq(actual: any, expected: any, label: string, failures: string[]) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) failures.push(`${label}: expected=${e} actual=${a}`);
}

function assertTrue(cond: any, label: string, failures: string[]) {
  if (!cond) failures.push(label);
}

function countMatches(lines: string[], re: RegExp): number {
  return lines.filter((ln) => re.test(ln)).length;
}

function extractDurations(lines: string[]): number[] {
  const out: number[] = [];
  for (const ln of lines) {
    const m = ln.match(/\[⏱️\s+\s*(\d+)ms\]\s+MCP Request (?:completed|closed|aborted)/);
    if (m?.[1]) out.push(Number(m[1]));
  }
  return out;
}

async function main() {
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  process.env.SMOKE_MODE = "1";
  process.env.LOG_MODE = process.env.LOG_MODE || "test";

  const evidenceDir = path.resolve(__dirname, "..", "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidenceFile = path.join(evidenceDir, `phase87-weather-resolver-loghygiene-${isoStamp()}.log`);

  const logLines: string[] = [];
  const failures: string[] = [];

  // --- (1) Resolver unit tests (6 deterministic assertions, no network) ---
  try {
    const { resolveProvinces } = await import("../src/utils/locationResolver");

    const cases: Array<{ q: string; want: string[]; label: string }> = [
      { q: "หลักสี่", want: ["กรุงเทพมหานคร"], label: "RES1(bkk-district-laksi)" },
      { q: "ลาดกระบัง", want: ["กรุงเทพมหานคร"], label: "RES2(bkk-district-ladkrabang)" },
      { q: "กทม", want: ["กรุงเทพมหานคร"], label: "RES3(bkk-abbrev-กทม)" },
      { q: "กรุงเทพ", want: ["กรุงเทพมหานคร"], label: "RES4(bkk-abbrev-กรุงเทพ)" },
      { q: "กรุงเทพฯ", want: ["กรุงเทพมหานคร"], label: "RES5(bkk-abbrev-กรุงเทพฯ)" },
      { q: "BKK", want: ["กรุงเทพมหานคร"], label: "RES6(bkk-abbrev-BKK)" },
    ];

    for (const c of cases) {
      const got = resolveProvinces(c.q);
      assertEq(got, c.want, c.label, failures);
    }

    logLines.push("resolver.unit: PASS");
  } catch (e: any) {
    failures.push(`resolver.unit: unexpected error: ${String(e?.message || e)}`);
  }

  // --- (2) Weather resolver accuracy: 3 Bangkok district weather queries must resolve กรุงเทพมหานคร ---
  try {
    const { WeatherPipeline } = await import("../src/utils/weather/weatherPipeline");

    // Dummy client: verifier must be zero-network.
    const dummyClients = new Map<string, any>([
      [
        "innomcp-server",
        {
          callTool: async () => {
            throw new Error("Verifier must not call MCP tools");
          },
        },
      ],
    ]);

    const p = new WeatherPipeline(dummyClients);

    const qs = [
      "พรุ่งนี้เขตหลักสี่ฝนตกไหม",
      "พรุ่งนี้เขตลาดกระบังฝนตกไหม",
      "พรุ่งนี้กทมฝนตกไหม",
    ];

    for (const [i, q] of qs.entries()) {
      const target = p.resolveTarget(q);
      assertTrue(target.provinces.includes("กรุงเทพมหานคร"), `WX_RES${i + 1}: must include กรุงเทพมหานคร`, failures);
      logLines.push(`wx.resolveTarget${i + 1} provinces=${JSON.stringify(target.provinces)}`);
    }

    logLines.push("wx.resolver: PASS");
  } catch (e: any) {
    failures.push(`wx.resolver: unexpected error: ${String(e?.message || e)}`);
  }

  // --- (3) National query remains national (no resolver province required) ---
  try {
    const { WeatherPipeline } = await import("../src/utils/weather/weatherPipeline");

    const dummyClients = new Map<string, any>([
      [
        "innomcp-server",
        {
          callTool: async () => {
            throw new Error("Verifier must not call MCP tools");
          },
        },
      ],
    ]);

    const p = new WeatherPipeline(dummyClients);
    const target = p.resolveTarget("พรุ่งนี้ทั่วประเทศฝนตกไหม");

    assertEq(target.provinces, [], "NAT1.provinces(empty)", failures);
    assertTrue(Boolean(target.intent.national), "NAT1.intent.national(true)", failures);

    // Execute nationwide deterministically by patching forecastEngine.getAllForecasts (no MCP/network)
    (p as any).forecastEngine.getAllForecasts = async () => {
      return [
        {
          ProvinceNameThai: "กรุงเทพมหานคร",
          SevenDaysForecast: {
            ForecastDate: ["01/01/2000"],
            PercentRainCover: [80],
            DescriptionThai: ["ฝนฟ้าคะนอง"],
            MaximumTemperature: [35],
            MinimumTemperature: [27],
            WindDirection: ["180"],
            WindSpeed: [10],
          },
        },
      ];
    };

    const results = await p.execute(target);
    const first = results?.[0];
    assertTrue(first && first.type === "national", "NAT2.execute(national)", failures);

    logLines.push(`national.execute type=${String(first?.type || "")}`);
    logLines.push("national: PASS");
  } catch (e: any) {
    failures.push(`national: unexpected error: ${String(e?.message || e)}`);
  }

  // --- (4) MCP timing finalize exactly once (2 abort/cancel scenarios) ---
  const mcpPort = await getFreePort();
  const healthUrl = `http://127.0.0.1:${mcpPort}/health`;
  const serverDir = path.resolve(__dirname, "..", "..", "innomcp-server-node");
  const mcpOut: string[] = [];

  const mcpChild = (() => {
    const env = {
      ...process.env,
      SERVER_HOST: "127.0.0.1",
      SERVER_PORT: String(mcpPort),
      SMOKE_MODE: "1",
      LOG_MODE: process.env.LOG_MODE || "test",
      WX_TMD_STATION_DELAY_MS: "5000",
      WX_TMD_DELAY_MS: "5000",
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
    await waitForHealth(healthUrl, 15_000);

    // Abort #1: destroy request while station tool is delaying (no network)
    const req1 = {
      jsonrpc: "2.0",
      id: 101,
      method: "tools/call",
      params: { name: "tmd_weather_3hours_all_stations", arguments: {} },
    };

    const r1 = await postJsonRaw(mcpPort, "/mcp", req1, { destroyAfterMs: 200 });
    logLines.push(`abort1.http=${r1.status} aborted=${r1.aborted} durMs=${r1.durMs}`);
    assertTrue(r1.aborted === true || r1.status === 0, "MCP_A1: expected client abort", failures);

    // Abort #2: destroy request while forecast tool is delaying (no network)
    const req2 = {
      jsonrpc: "2.0",
      id: 102,
      method: "tools/call",
      params: { name: "tmd_weather_forecast_7days_by_province", arguments: {} },
    };

    const r2 = await postJsonRaw(mcpPort, "/mcp", req2, { destroyAfterMs: 200 });
    logLines.push(`abort2.http=${r2.status} aborted=${r2.aborted} durMs=${r2.durMs}`);
    assertTrue(r2.aborted === true || r2.status === 0, "MCP_A2: expected client abort", failures);

    // Give server time to flush logs
    await new Promise((r) => setTimeout(r, 600));

    const joined = mcpOut.join("");
    const lines = joined.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

    // Exactly one finalize record per request (completed|closed|aborted)
    const finalizeRe = /MCP Request (completed|closed \(client disconnect\)|aborted \(client abort\)):/;
    const finalizedCount = countMatches(lines, finalizeRe);

    // Both requests are destroyed -> should finalize as closed/aborted, and must be exactly 2 total.
    assertTrue(finalizedCount === 2, `MCP1: expected 2 finalize records, got ${finalizedCount}`, failures);

    const completedCount = countMatches(lines, /MCP Request completed:/);
    assertTrue(completedCount === 0, `MCP1b: expected 0 completed records, got ${completedCount}`, failures);

    const durs = extractDurations(lines);
    assertTrue(durs.length === 2, `MCP2: expected 2 durations, got ${durs.length}`, failures);
    const tooBig = durs.filter((d) => Number.isFinite(d) && d > 60_000);
    assertTrue(tooBig.length === 0, `MCP3: duration must be sane (<60s), got=${JSON.stringify(durs)}`, failures);

    // Best-effort marker (informational only): if tool-layer abort logs are present, record one.
    const tmdAborted = lines.filter((ln) => /\[TMD:.*\]\s+failed\s+time=.*err=TMD API aborted/.test(ln));

    logLines.push(`mcp.finalize.count=${finalizedCount}`);
    logLines.push(`mcp.finalize.durations=${JSON.stringify(durs)}`);
    logLines.push(`mcp.tmd.abort.count=${tmdAborted.length}`);
    if (tmdAborted[0]) logLines.push(`mcp.tmd.abort.sample=${tmdAborted[0]}`);

    logLines.push("mcp.timing: PASS");
  } catch (e: any) {
    failures.push(`mcp.timing: unexpected error: ${String(e?.message || e)}`);
  } finally {
    try {
      mcpChild.kill();
    } catch {
      // ignore
    }
  }

  const ok = failures.length === 0;
  logLines.push(ok ? "RESULT: PASS" : "RESULT: FAIL");
  if (!ok) logLines.push("FAILURES:\n" + failures.join("\n"));

  fs.writeFileSync(evidenceFile, logLines.join("\n") + "\n", "utf8");

  if (ok) {
    console.log("RESULT: PASS");
    console.log(`evidenceFile=${evidenceFile}`);
    process.exit(0);
  }

  console.error("RESULT: FAIL");
  console.error(failures.join("\n"));
  console.error(`evidenceFile=${evidenceFile}`);
  process.exit(1);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
