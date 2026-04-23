import { NextResponse, NextRequest } from "next/server";
import { jwtMiddleware } from "@/jwtmiddleware";

// GET /api/admin/metrics — proxy to innomcp-node /api/metrics (admin only)
export async function GET(req: NextRequest) {
  const jwtResult = jwtMiddleware(req);
  if (jwtResult instanceof NextResponse) return jwtResult;

  const { decoded } = jwtResult;
  if (!decoded || typeof decoded !== "object" || decoded.userrole_id !== 0) {
    return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
  }

  const backendHost = process.env.NODE_BACKEND_HOST || "http://localhost:3011";

  try {
    const res = await fetch(`${backendHost}/api/metrics`, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: `Backend returned ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[admin/metrics]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch metrics" }, { status: 503 });
  }
}
