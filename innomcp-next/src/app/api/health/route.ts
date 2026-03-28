import { NextResponse } from "next/server";

export async function GET() {
  // Accept multiple env var names — NEXT_PUBLIC_NODE_HOST is set in .env.local for dev
  const backendUrl = (
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    process.env.NEXT_PUBLIC_NODE_HOST ??
    "http://localhost:3011"
  ).replace(/\/$/, "");
  try {
    const [healthRes, aiModeRes] = await Promise.all([
      fetch(`${backendUrl}/api/health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      }),
      fetch(`${backendUrl}/api/ai-mode`, {
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      }).catch(() => null),
    ]);

    const healthData = await healthRes.json().catch(() => ({ status: "error" }));
    const aiModeData = aiModeRes && aiModeRes.ok ? await aiModeRes.json() : null;
    const normalizedStatus = String(healthData?.status || "error").toLowerCase();
    const mode = normalizedStatus === "healthy" ? "online" : "offline";
    const modeReady = normalizedStatus === "healthy" || normalizedStatus === "degraded";
    const mcpStatus = Array.isArray(healthData?.services)
      ? healthData.services.some((service: { name?: string; status?: string }) => {
          const serviceName = String(service?.name || "").toLowerCase();
          return serviceName.includes("mcp") && String(service?.status || "").toLowerCase() === "healthy";
        })
        ? "connected"
        : "unknown"
      : "unknown";

    return NextResponse.json({
      status: normalizedStatus,
      service: "innomcp-next",
      mode,
      mode_ready: modeReady,
      ai_mode: aiModeData?.mode,
      mcp_status: mcpStatus,
      services: healthData?.services,
      timestamp: healthData?.timestamp,
      uptime: healthData?.uptime,
    });
  } catch {
    return NextResponse.json(
      { status: "degraded", service: "innomcp-next", mode: "offline", mode_ready: false, notes: ["backend unreachable"] },
      { status: 200 }
    );
  }
}
