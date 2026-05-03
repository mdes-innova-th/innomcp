import { NextResponse } from "next/server";

export async function GET() {
  // Accept multiple env var names — canonical is NEXT_PUBLIC_API_URL (3011)
  const backendUrl = (
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    process.env.NEXT_PUBLIC_NODE_HOST ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:3011"
  ).replace(/\/$/, "");
  try {
    const healthRes = await fetch(`${backendUrl}/api/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });

    const healthData = await healthRes.json().catch(() => ({ status: "error" }));
    const normalizedStatus = String(healthData?.status || "error").toLowerCase();
    const modeReady = typeof healthData?.mode_ready === "boolean"
      ? healthData.mode_ready
      : normalizedStatus === "healthy";
    const mode = typeof healthData?.mode === "string"
      ? healthData.mode
      : normalizedStatus === "healthy" || normalizedStatus === "degraded"
        ? "online"
        : "offline";
    const derivedMcpStatus = Array.isArray(healthData?.services)
      ? healthData.services.some((service: { name?: string; status?: string }) => {
          const serviceName = String(service?.name || "").toLowerCase();
          const serviceStatus = String(service?.status || "").toLowerCase();
          return serviceName.includes("mcp") && (serviceStatus === "healthy" || serviceStatus === "degraded");
        })
        ? "connected"
        : "unknown"
      : "unknown";
    const mcpStatus = String(healthData?.mcp_status || derivedMcpStatus);
    const redisStatus = typeof healthData?.redis_status === "string"
      ? healthData.redis_status
      : "unknown";
    const redisReady = typeof healthData?.redis_ready === "boolean"
      ? healthData.redis_ready
      : redisStatus === "ready";
    const redisConfigured = typeof healthData?.redis_configured === "boolean"
      ? healthData.redis_configured
      : false;
    const redisRetryAfterMs = Number(healthData?.redis_retry_after_ms ?? 0);

    return NextResponse.json({
      status: normalizedStatus,
      service: "innomcp-next",
      mode,
      mode_ready: modeReady,
      ai_mode: typeof healthData?.ai_mode === "string" ? healthData.ai_mode : undefined,
      mcp_status: mcpStatus,
      redis_status: redisStatus,
      redis_ready: redisReady,
      redis_configured: redisConfigured,
      redis_retry_after_ms: redisRetryAfterMs,
      local_tools: Number(healthData?.local_tools || 0),
      remote_tools: Number(healthData?.remote_tools || 0),
      total_tools: Number(healthData?.total_tools || 0),
      notes: Array.isArray(healthData?.notes) ? healthData.notes : [],
      services: healthData?.services,
      timestamp: healthData?.timestamp,
      uptime: healthData?.uptime,
    });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        service: "innomcp-next",
        mode: "offline",
        mode_ready: false,
        mcp_status: "disconnected",
        redis_status: "unknown",
        redis_ready: false,
        redis_configured: false,
        redis_retry_after_ms: 0,
        local_tools: 0,
        remote_tools: 0,
        total_tools: 0,
        notes: ["backend unreachable"],
      },
      { status: 200 }
    );
  }
}
