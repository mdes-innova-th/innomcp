import { NextRequest, NextResponse } from "next/server";
import { logUserActivity } from "@/app/lib/loguser";
import { withDbConnection } from "@/app/lib/db";
import { jwtMiddleware } from "@/jwtmiddleware";

// DELETE - ลบผู้ใช้
export async function DELETE(request: NextRequest) {
  try {
    // ตรวจสอบ JWT ด้วย jwtMiddleware
    const jwtResult = jwtMiddleware(request);
    if (jwtResult instanceof NextResponse) {
      return jwtResult;
    }
    if (!jwtResult || !jwtResult.valid || !jwtResult.decoded) {
      return NextResponse.json(
        { message: "กรุณาเข้าสู่ระบบก่อนใช้งาน" },
        { status: 401 }
      );
    }

    const user = jwtResult.decoded as { userrole_id: number; user_id: number };
    // ตรวจสอบว่าเป็นแอดมินหรือไม่
    if (user.userrole_id !== 0) {
      return NextResponse.json({ message: "Access denied" }, { status: 403 });
    }

    // ดึง URL และข้อมูลจาก query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("id");
    if (!userId) {
      return NextResponse.json({ message: "ไม่พบรหัสผู้ใช้" }, { status: 400 });
    }
    // ใช้ withDbConnection เพื่อจัดการการเชื่อมต่อฐานข้อมูล
    await withDbConnection(async (connection) => {
      await connection.execute("DELETE FROM user WHERE user_id = ?", [userId]);
    });
    // log การลบผู้ใช้
    await logUserActivity({
      user_id: user.user_id,
      activity: `Deleted user user_id: ${userId}`,
      request: request,
    });
    return NextResponse.json({ message: "ลบผู้ใช้สำเร็จ!" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดในการลบผู้ใช้" },
      { status: 500 }
    );
  }
}
