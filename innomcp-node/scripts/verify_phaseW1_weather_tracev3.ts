/*
Phase W1: Trace v3 Evidence Generator
- Produces exactly 12 [ChatTrace] lines:
  - 3 prompts via HTTP: IN+OUT => 6 lines
  - 3 prompts via WS:   IN+OUT => 6 lines
- Must be deterministic, non-LLM, include update time, and avoid JSON.
*/

import net from "net";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import WebSocket from "ws";

type TraceCheck = {
  line: string;
  transport: "http" | "ws";
  route: string;
  answer: string;
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

async function sendHttpChat(baseUrl: string, cid: string, message: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-correlation-id": cid,
    },
    body: JSON.stringify({ message, uiMode: "auto" }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  // Drain body
  await res.text().catch(() => "");
}

async function sendWsChat(wsUrl: string, cid: string, message: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(wsUrl, {
      headers: {
        "x-correlation-id": cid,
      },
    });

    const timeout = setTimeout(() => {
      try { ws.close(); } catch {}
      reject(new Error("WS timeout waiting for done"));
    }, 12_000);

    ws.on("open", () => {
      ws.send(JSON.stringify({ text: message, uiMode: "auto" }));
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw || "{}"));
        if (msg?.type === "done") {
          clearTimeout(timeout);
          try { ws.close(); } catch {}
          resolve();
        }
      } catch {
        // ignore
      }
    });

    ws.on("error", (e) => {
      clearTimeout(timeout);
      reject(e);
    });
  });
}

function parseTraceLine(line: string): TraceCheck | null {
  if (!line.includes("[ChatTrace]")) return null;
  const tMatch = line.match(/\bt=(http|ws)\b/);
  const routeMatch = line.match(/\broute=([^\s]+)\b/);
  const aMatch = line.match(/\ba='([^']*)'/);
  if (!tMatch || !routeMatch || !aMatch) return null;
  return {
    line,
    transport: tMatch[1] as any,
    route: routeMatch[1],
    answer: aMatch[1],
  };
}

function assert(cond: any, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function run() {
  const port = await getFreePort();
  const host = "127.0.0.1";
  const baseUrl = `http://${host}:${port}`;
  const wsUrl = `ws://${host}:${port}/chat`;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const cid = `phaseW1-weather-${stamp}`;
  const cidShort = cid.slice(0, 8);

  const evidenceDir = path.join(__dirname, "..", "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });

  const evidenceTraceFile = path.join(evidenceDir, `phaseW1-weather-tracev3-${stamp}.log`);
  const verifierOutFile = path.join(evidenceDir, `phaseW1-weather-tracev3-${stamp}.out.log`);

  const isWin = process.platform === "win32";
  const cmd = isWin ? "cmd.exe" : "npx";
  const args = isWin
    ? ["/d", "/c", "npx ts-node src/index.ts"]
    : ["ts-node", "src/index.ts"];

  const child = spawn(cmd, args, {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      SERVER_HOST: host,
      SERVER_PORT: String(port),
      NODE_ENV: "development",
      CHAT_TRACE_QA: "1",
      LOG_DEBUG: "0",
      WEATHER_FIXTURE_W1: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  const lines: string[] = [];
  const onData = (buf: Buffer) => {
    const chunk = buf.toString("utf8");
    for (const l of chunk.split(/\r?\n/)) {
      if (l.includes("[ChatTrace]")) lines.push(l.trim());
    }
  };
  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);

  try {
    await waitForHealth(baseUrl, 15_000);

    const prompts = [
      "ตอนนี้ กทม ฝนตกไหม",
      "วันนี้ กทม ฝนจะตกช่วงไหน",
      "พรุ่งนี้ เชียงราย ฝนตกไหม",
    ];

    // 3 prompts via HTTP
    for (const p of prompts) {
      await sendHttpChat(baseUrl, cid, p);
    }

    // 3 prompts via WS
    for (const p of prompts) {
      await sendWsChat(wsUrl, cid, p);
    }

    // Give a small buffer for trace flush
    await sleep(400);

    const ours = lines.filter((l) => l.includes(`cid=${cidShort}`));

    // Expect exactly 12 lines: (3 prompts * 2 lines) * 2 transports
    assert(ours.length === 12, `Expected 12 trace lines for cid=${cidShort}, got ${ours.length}`);

    const parsed = ours.map(parseTraceLine).filter(Boolean) as TraceCheck[];
    assert(parsed.length === 12, "Failed to parse all trace lines");

    const httpCount = parsed.filter((p) => p.transport === "http").length;
    const wsCount = parsed.filter((p) => p.transport === "ws").length;
    assert(httpCount === 6, `Expected 6 http trace lines, got ${httpCount}`);
    assert(wsCount === 6, `Expected 6 ws trace lines, got ${wsCount}`);

    const outs = parsed.filter((p) => p.route === "weatherGate");
    assert(outs.length === 6, `Expected 6 OUT lines route=weatherGate, got ${outs.length}`);

    for (const o of outs) {
      assert(/เวลาอัปเดตข้อมูล\s*:/i.test(o.answer), "OUT must include update time");
      assert(!/\[JSON_REDACTED\]/.test(o.answer), "OUT must not be JSON redacted");
      assert(!/^\s*[\[{]/.test(o.answer), "OUT must not look like JSON");
    }

    fs.writeFileSync(evidenceTraceFile, ours.join("\n") + "\n", "utf8");

    const summary = [
      `OK cid=${cid} port=${port}`,
      `traceLines=12 httpLines=6 wsLines=6 outLines=6`,
      `evidenceTraceFile=${evidenceTraceFile}`,
    ].join("\n");

    fs.writeFileSync(verifierOutFile, summary + "\n", "utf8");
    console.log(summary);

  } finally {
    try { child.kill("SIGINT"); } catch {}
    await sleep(300);
    try { child.kill("SIGKILL"); } catch {}
  }
}

run().catch((e) => {
  console.error(String(e?.stack || e));
  process.exit(1);
});
