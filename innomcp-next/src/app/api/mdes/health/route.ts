// app/api/mdes/health/route.ts
import { NextResponse } from "next/server";

const MDES_OLLAMA = "https://ollama.mdes-innova.online";

export async function GET(): Promise<NextResponse> {
  const t0 = Date.now();

  try {
    const r = await fetch(`${MDES_OLLAMA}/api/version`, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 60 }, // cache 1 min
    });

    const latencyMs = Date.now() - t0;

    if (!r.ok) {
      return NextResponse.json({ healthy: false, latencyMs });
    }

    const data = await r.json().catch(() => ({}));

    return NextResponse.json({
      healthy: true,
      latencyMs,
      version: data.version,
    });
  } catch (e: unknown) {
    return NextResponse.json({
      healthy: false,
      latencyMs: Date.now() - t0,
      error: String(e),
    });
  }
}