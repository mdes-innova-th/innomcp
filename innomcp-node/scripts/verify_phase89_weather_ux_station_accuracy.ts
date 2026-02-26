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
          Accept: "application/json, text/plain, */*",
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

function firstLineMatching(text: string, re: RegExp): string | null {
  for (const ln of String(text || "").split(/\r?\n/)) {
    if (re.test(ln)) return ln.trim();
  }
  return null;
}

function assertNoForbiddenOutput(text: string): string[] {
  const failures: string[] = [];
  const t = String(text || "");

  const forbidden = [
    { re: /```/, why: "found code fence```" },
    { re: /\{/, why: "found '{' (raw JSON-like)" },
    { re: /\}/, why: "found '}' (raw JSON-like)" },
    { re: /\bโหมดทดสอบ\b/i, why: "found test-mode phrase" },
    { re: /เพื่อการทดสอบระบบ/i, why: "found test placeholder" },
    { re: /ค่ากลาง/i, why: "found placeholder word" },
    { re: /30\s*°?C\s*70%\s*20%/i, why: "found placeholder combo 30°C 70% 20%" },
  ];

  for (const f of forbidden) {
    if (f.re.test(t)) failures.push(f.why);
  }
  return failures;
}

type CaseResult = {
  name: string;
  message: string;
  ok: boolean;
  status: number;
  durMs: number;
  failures: string[];
  textSample: string;
};

async function main() {
  const stamp = isoStamp();
  const evidenceDir = path.resolve(__dirname, "..", "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });

  const base = path.resolve(evidenceDir, `phase89-weather-ux-station-accuracy-${stamp}`);
  const traceFile = `${base}.tracev3.log`;
  const outFile = `${base}.out.log`;
  const jsonFile = `${base}.report.json`;

  const failures: string[] = [];
  const caseResults: CaseResult[] = [];

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
      // Do not rely on real upstream.
      WX_TMD_DELAY_MS: "0",
      WX_TMD_STATION_DELAY_MS: "0",
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
      // Deterministic weather fixtures (no real TMD/NWP)
      WEATHER_FIXTURE_W1: "1",
      // Trace v3 artifact
      CHAT_TRACE_QA: "1",
      LOG_DEBUG: "0",
      // Verifier-only counter markers
      WX_VERIFY_COUNTER: "1",
    }
  );
  beChild.stdout?.on("data", (b) => beOut.push(String(b)));
  beChild.stderr?.on("data", (b) => beOut.push(String(b)));

  const mcpHealth = `http://127.0.0.1:${mcpPort}/health`;
  const beHealth = `http://127.0.0.1:${bePort}/health`;

  try {
    await waitForHealth(mcpHealth, 20_000);
    await waitForHealth(beHealth, 20_000);

    const chatUrl = `http://127.0.0.1:${bePort}/api/chat`;

    const cases: Array<{ name: string; message: string; assert: (text: string) => string[] }> = [
      {
        name: "multi-target-bkk-laksi-lkb",
        message: "กรุงเทพ หลักสี่ และลาดกระบังฝนตกไหม จงบอกแบบละเอียด",
        assert: (text) => {
          const errs: string[] = [];
          const blocks = extractAreaBlocks(text);
          if (blocks.length !== 2) errs.push(`expected 2 area blocks, got ${blocks.length}`);
          for (const b of blocks) {
            if (!hasAllFields(b)) errs.push("missing required fields in a block");
          }
          const firstArea = firstLineMatching(text, /^\s*พื้นที่\s*:\s*กรุงเทพมหานคร\s*\(หลักสี่\)/m);
          const secondArea = firstLineMatching(text, /^\s*พื้นที่\s*:\s*กรุงเทพมหานคร\s*\(ลาดกระบัง\)/m);
          if (!firstArea) errs.push("missing 'พื้นที่: กรุงเทพมหานคร (หลักสี่)' block");
          if (!secondArea) errs.push("missing 'พื้นที่: กรุงเทพมหานคร (ลาดกระบัง)' block");
          return errs;
        },
      },
      {
        name: "single-district-bkk-laksi",
        message: "กรุงเทพ หลักสี่ ฝนตกไหม แบบละเอียด",
        assert: (text) => {
          const errs: string[] = [];
          const blocks = extractAreaBlocks(text);
          if (blocks.length < 1) errs.push("expected at least 1 area block");
          if (!firstLineMatching(text, /^\s*พื้นที่\s*:\s*กรุงเทพมหานคร\s*\(หลักสี่\)/m)) {
            errs.push("missing 'พื้นที่: กรุงเทพมหานคร (หลักสี่)' in output");
          }
          if (blocks[0] && !hasAllFields(blocks[0])) errs.push("missing required fields");
          return errs;
        },
      },
      {
        name: "district-only-lkb-resolves-bkk",
        message: "ลาดกระบัง ฝนตกไหม แบบละเอียด",
        assert: (text) => {
          const errs: string[] = [];
          if (!firstLineMatching(text, /^\s*พื้นที่\s*:\s*กรุงเทพมหานคร\s*\(ลาดกระบัง\)/m)) {
            errs.push("district-only must resolve to Bangkok area label");
          }
          const blocks = extractAreaBlocks(text);
          if (blocks[0] && !hasAllFields(blocks[0])) errs.push("missing required fields");
          return errs;
        },
      },
      {
        name: "province-missing-token",
        message: "ฝนตกไหม แบบละเอียด",
        assert: (text) => {
          const errs: string[] = [];
          if (!/ERR:WX_PROVINCE_MISSING/.test(text)) errs.push("expected ERR:WX_PROVINCE_MISSING");
          return errs;
        },
      },
      {
        name: "province-not-found-forecast-no-data",
        message: "พรุ่งนี้ มุกดาหาร ฝนตกไหม แบบละเอียด",
        assert: (text) => {
          const errs: string[] = [];
          if (!/ERR:WX_NO_DATA/.test(text)) errs.push("expected ERR:WX_NO_DATA");
          const blocks = extractAreaBlocks(text);
          if (blocks.length !== 1) errs.push(`expected 1 area block, got ${blocks.length}`);
          if (blocks[0] && !hasAllFields(blocks[0])) errs.push("no-data block must still include 5 fields");
          return errs;
        },
      },
      {
        name: "other-province-has-data",
        message: "พรุ่งนี้ เชียงราย ฝนตกไหม แบบละเอียด",
        assert: (text) => {
          const errs: string[] = [];
          if (!firstLineMatching(text, /^\s*พื้นที่\s*:\s*เชียงราย/m)) errs.push("expected area=เชียงราย");
          const blocks = extractAreaBlocks(text);
          if (blocks[0] && !hasAllFields(blocks[0])) errs.push("missing required fields");
          return errs;
        },
      },
    ];

    for (const c of cases) {
      const r = await postJson(chatUrl, { message: c.message }, 25_000);

      let parsed: any = null;
      try {
        parsed = JSON.parse(r.raw);
      } catch {
        // ignore
      }

      const text = String(parsed?.text || "");
      const sample = text.replace(/\s+/g, " ").trim().slice(0, 240);

      const localFailures: string[] = [];
      if (r.status < 200 || r.status >= 300) localFailures.push(`http status ${r.status}`);
      if (!text.trim()) localFailures.push("empty text output");

      localFailures.push(...assertNoForbiddenOutput(text));
      localFailures.push(...c.assert(text));

      const ok = localFailures.length === 0;
      if (!ok) {
        failures.push(`case=${c.name} fail=${localFailures.join(" | ")}`);
      }

      caseResults.push({
        name: c.name,
        message: c.message,
        ok,
        status: r.status,
        durMs: r.durMs,
        failures: localFailures,
        textSample: sample,
      });
    }

    const combinedBackend = beOut.join("");
    const nwpCalls = (combinedBackend.match(/\[WX_COUNTER\]\s+nwp_call\b/g) || []).length;
    if (nwpCalls !== 0) {
      failures.push(`expected no NWP calls, found ${nwpCalls}`);
    }

    // Write artifacts
    const traceLines = combinedBackend
      .split(/\r?\n/)
      .filter((ln) => ln.includes("[ChatTrace]"))
      .join("\n");
    fs.writeFileSync(traceFile, traceLines + (traceLines ? "\n" : ""), "utf8");

    const outLines: string[] = [];
    outLines.push(`PHASE 8.9 verifier stamp=${stamp}`);
    outLines.push(`mcpPort=${mcpPort} bePort=${bePort}`);
    outLines.push(`nwpCalls=${nwpCalls}`);
    outLines.push("");
    for (const cr of caseResults) {
      outLines.push(`CASE ${cr.ok ? "PASS" : "FAIL"} name=${cr.name} ms=${cr.durMs} status=${cr.status}`);
      if (!cr.ok) outLines.push(`  failures=${cr.failures.join(" | ")}`);
      outLines.push(`  sample=${cr.textSample}`);
      outLines.push("");
    }
    outLines.push("--- backend(out) ---");
    outLines.push(combinedBackend);
    outLines.push("--- mcp(out) ---");
    outLines.push(mcpOut.join(""));
    fs.writeFileSync(outFile, outLines.join("\n"), "utf8");

    const report = {
      phase: "8.9",
      stamp,
      ok: failures.length === 0,
      failures,
      artifacts: {
        tracev3: path.basename(traceFile),
        out: path.basename(outFile),
        reportJson: path.basename(jsonFile),
      },
      nwpCalls,
      cases: caseResults,
    };
    fs.writeFileSync(jsonFile, JSON.stringify(report, null, 2), "utf8");

    if (report.ok) {
      console.log(`RESULT: PASS`);
      console.log(`evidenceTrace=${traceFile}`);
      console.log(`evidenceOut=${outFile}`);
      console.log(`evidenceJson=${jsonFile}`);
    } else {
      console.log(`RESULT: BLOCKED`);
      console.log(`evidenceTrace=${traceFile}`);
      console.log(`evidenceOut=${outFile}`);
      console.log(`evidenceJson=${jsonFile}`);
      for (const f of failures.slice(0, 8)) console.log(`FAIL: ${f}`);
      process.exitCode = 2;
    }
  } finally {
    try {
      mcpChild.kill();
    } catch {}
    try {
      beChild.kill();
    } catch {}
  }
}

main().catch((e) => {
  console.error("Verifier crashed:", e);
  process.exitCode = 1;
});
