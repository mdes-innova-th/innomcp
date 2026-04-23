import { NextResponse, NextRequest } from "next/server";
import { withDbConnection } from "@/app/lib/db";
import { jwtMiddleware } from "@/jwtmiddleware";

// GET /api/admin/users — list all users (admin only)
export async function GET(req: NextRequest) {
  const jwtResult = jwtMiddleware(req);
  if (jwtResult instanceof NextResponse) return jwtResult;

  const { decoded } = jwtResult;
  if (!decoded || typeof decoded !== "object" || decoded.userrole_id !== 0) {
    return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
  }

  try {
    const data = await withDbConnection(async (conn) => {
      const [rows] = await conn.execute(
        "SELECT user_id, user_dispname, user_email, userrole_id, user_active, created_at FROM `user` ORDER BY user_id ASC"
      );
      return rows;
    });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[admin/users GET]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch users" }, { status: 500 });
  }
}
