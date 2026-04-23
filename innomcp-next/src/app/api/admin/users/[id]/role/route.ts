import { NextResponse, NextRequest } from "next/server";
import { withDbConnection } from "@/app/lib/db";
import { jwtMiddleware } from "@/jwtmiddleware";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/admin/users/[id]/role — update user role (admin only)
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

  let body: { roleId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const roleId = body.roleId;
  if (typeof roleId !== "number") {
    return NextResponse.json({ success: false, error: "roleId must be a number" }, { status: 400 });
  }

  // Prevent self-demotion
  if ((decoded as { user_id?: number }).user_id === targetId && roleId !== 0) {
    return NextResponse.json({ success: false, error: "Cannot change your own admin role" }, { status: 400 });
  }

  try {
    const result = await withDbConnection(async (conn) => {
      const [info] = await conn.execute(
        "UPDATE `user` SET userrole_id = ? WHERE user_id = ?",
        [roleId, targetId]
      );
      return info as { affectedRows: number };
    });

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: `User ${targetId} role updated to ${roleId}` });
  } catch (err) {
    console.error("[admin/users/role PATCH]", err);
    return NextResponse.json({ success: false, error: "Failed to update role" }, { status: 500 });
  }
}
