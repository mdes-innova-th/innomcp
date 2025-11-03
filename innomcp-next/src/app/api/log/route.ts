import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    // Log to server console (can be replaced with DB, file, or external logging)
    console.log("[api/log] Login params:", data);
    // Respond success
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/log] Error parsing log data:", error);
    return NextResponse.json(
      { success: false, error: "Invalid log data" },
      { status: 400 }
    );
  }
}
