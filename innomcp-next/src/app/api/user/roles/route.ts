import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2/promise";
import { jwtMiddleware } from "@/jwtmiddleware";
import { withDbConnection } from "@/app/lib/db";

// GET - รายการบทบาทผู้ใช้
export async function GET(request: NextRequest) {
  // ตรวจสอบ JWT ก่อน
  const jwtResult = jwtMiddleware(request);
  if (jwtResult instanceof NextResponse) {
    return jwtResult;
  }
  try {
    const rows = await withDbConnection(async (connection) => {
      const [result] = await connection.execute<RowDataPacket[]>(
        "SELECT userrole_id, userrole_name FROM userrole ORDER BY userrole_id ASC"
      );
      return result;
    });
    return NextResponse.json({ roles: rows }, { status: 200 });
  } catch (error) {
    console.error("Error fetching user roles:", error);
    // Fallback roles if database table doesn't exist yet
    const fallbackRoles = [
      { userrole_id: "0", userrole_name: "ผู้ดูแลระบบสูงสุด" },
      { userrole_id: "1", userrole_name: "ผู้ใช้งานทั่วไป" },
      { userrole_id: "2", userrole_name: "ผู้ดูแลระบบ" },
    ];
    return NextResponse.json(
      {
        roles: fallbackRoles,
        message: "Using fallback roles due to database error",
      },
      { status: 200 }
    );
  }
}
