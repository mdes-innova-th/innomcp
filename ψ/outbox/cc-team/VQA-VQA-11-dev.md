<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-11 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":96,"completion_tokens":784,"total_tokens":880,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":213,"image_tokens":0},"cache_creation_input_tokens":0} | 16s
 generated: 2026-06-12T04:21:09.577Z -->
```ts
import { NextResponse } from "next/server";
import net from "net";

function parseWsTarget(raw: string): { host: string; port: number } {
  try {
    const u = new URL(raw);
    const port = u.port
      ? Number(u.port)
      : u.protocol === "wss:"
        ? 443
        : 80;
    return { host: u.hostname, port };
  } catch {
    // Fallback: treat as host:port
    const [host, portStr] = raw.split(":");
    return { host: host || "localhost", port: portStr ? Number(portStr) : 3011 };
  }
}

function tcpCheck(host: string, port: number, timeoutMs = 3000): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const socket = net.createConnection({ host, port });

    const cleanup = () => {
      socket.removeAllListeners("connect");
      socket.removeAllListeners("error");
      socket.removeAllListeners("timeout");
    };

    const timer = setTimeout(() => {
      cleanup();
      socket.destroy();
      reject(new Error("timeout"));
    }, timeoutMs);

    socket.once("connect", () => {
      const latency = Date.now() - start;
      clearTimeout(timer);
      cleanup();
      socket.end();
      resolve(latency);
    });

    socket.once("error", (err) => {
      clearTimeout(timer);
      cleanup();
      socket.destroy();
      reject(err);
    });

    socket.once("timeout", () => {
      clearTimeout(timer);
      cleanup();
      socket.destroy();
      reject(new Error("timeout"));
    });

    socket.setTimeout(timeoutMs);
  });
}

export async function GET() {
  const raw = process.env.NEXT_PUBLIC_NODE_WS_HOST ?? "ws://localhost:3011";
  const { host, port } = parseWsTarget(raw);

  try {
    const latencyMs = await tcpCheck(host, port);
    return NextResponse.json({
      reachable: true,
      host: `${host}:${port}`,
      latencyMs,
    });
  } catch {
    return NextResponse.json(
      {
        reachable: false,
        host: `${host}:${port}`,
        latencyMs: -1,
      },
      { status: 200 },
    );
  }
}
```
