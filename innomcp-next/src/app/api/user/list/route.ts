import { NextResponse, NextRequest } from "next/server";
import { withDbConnection } from "@/app/lib/db";
import { jwtMiddleware } from "@/jwtmiddleware";

// GET - รายการผู้ใช้ (สำหรับแอดมินเท่านั้น)
export async function GET(req: NextRequest) {
  // ตรวจสอบ JWT ก่อน
  const jwtResult = jwtMiddleware(req);
  if (jwtResult instanceof NextResponse) {
    return jwtResult;
  }

  // ตรวจสอบสิทธิ์แอดมิน (userrole_id = 0)
  const { decoded } = jwtResult;
  if (!decoded || typeof decoded !== "object" || decoded.userrole_id !== 0) {
    return NextResponse.json(
      { message: "Access denied" },
      { status: 403 }
    );
  }

  let connection;
  try {
    connection = await withDbConnection(async (conn) => {
      const [rows] = await conn.execute(
        "SELECT user_id, username, user_dispname, user_email, user_phone, user_active, userrole_id FROM user ORDER BY user_id DESC"
      );
      return rows;
    });
    return NextResponse.json({ users: connection }, { status: 200 });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้" },
      { status: 500 }
    );
  }
}
