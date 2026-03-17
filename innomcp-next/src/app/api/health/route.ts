import { NextResponse } from "next/server";

export async function GET() {
  // Accept multiple env var names — NEXT_PUBLIC_NODE_HOST is set in .env.local for dev
  const backendUrl = (
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    process.env.NEXT_PUBLIC_NODE_HOST ??
    "http://localhost:3011"
  ).replace(/\/$/, "");
  try {
    const res = await fetch(`${backendUrl}/api/health/keys`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { status: "error", service: "innomcp-next", reason: `backend returned ${res.status}` },
        { status: 502 }
      );
    }
    const data = await res.json();
    return NextResponse.json({ status: "ok", service: "innomcp-next", ...data });
  } catch {
    return NextResponse.json(
      { status: "degraded", service: "innomcp-next", mode: "offline", mode_ready: false, notes: ["backend unreachable"] },
      { status: 200 }
    );
  }
}
