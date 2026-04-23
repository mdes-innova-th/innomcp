import { NextResponse, NextRequest } from "next/server";
import { withDbConnection } from "@/app/lib/db";
import { jwtMiddleware } from "@/jwtmiddleware";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/admin/users/[id]/active — toggle user active status (admin only)
export async function PATCH(req: NextRequest, { params }: Params) {
  const jwtResult = jwtMiddleware(req);
  if (jwtResult instanceof NextResponse) return jwtResult;

  const { decoded } = jwtResult;
  if (!decoded || typeof decoded !== "object" || decoded.userrole_id !== 0) {
    return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
  }

  const { id } = await params;
  const targetId = parseInt(id, 10);
  if (isNaN(targetId)) {
    return NextResponse.json({ success: false, error: "Invalid user ID" }, { status: 400 });
  }

  let body: { active?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.active !== "boolean") {
    return NextResponse.json({ success: false, error: "active must be a boolean" }, { status: 400 });
  }

  const active = body.active;

  // Prevent self-deactivation
  if ((decoded as { user_id?: number }).user_id === targetId && !active) {
    return NextResponse.json({ success: false, error: "Cannot deactivate your own account" }, { status: 400 });
  }

  try {
    const result = await withDbConnection(async (conn) => {
      const [info] = await conn.execute(
        "UPDATE `user` SET user_active = ? WHERE user_id = ?",
        [active ? 1 : 0, targetId]
      );
      return info as { affectedRows: number };
    });

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `User ${targetId} ${active ? "activated" : "deactivated"}`,
    });
  } catch (err) {
    console.error("[admin/users/active PATCH]", err);
    return NextResponse.json({ success: false, error: "Failed to update status" }, { status: 500 });
  }
}
