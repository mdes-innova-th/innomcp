import { NextRequest, NextResponse } from "next/server";
import { logUserActivity } from "@/app/lib/loguser";
import { RowDataPacket } from "mysql2/promise";
import bcrypt from "bcrypt";
import { jwtMiddleware } from "@/jwtmiddleware";
import { withDbConnection } from "@/app/lib/db";

// PUT - อัพเดทข้อมูลผู้ใช้
export async function PUT(request: NextRequest) {
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
    if (user.userrole_id !== 0) {
      return NextResponse.json({ message: "Access denied" }, { status: 403 });
    }

    const body = await request.json();

    const user_id = body.user_id;
    const user_dispname = body.user_dispname?.trim();
    const user_email = body.user_email?.trim();
    const user_phone = body.user_phone?.trim();
    const user_active = body.user_active;
    const userrole_id = body.userrole_id;
    const password = body.password?.trim();

    if (!user_id || !user_dispname) {
      return NextResponse.json(
        { message: "กรุณาใส่ข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    // ตรวจสอบรูปแบบของอีเมล (ถ้ามีการกรอก)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (user_email && user_email !== "" && !emailRegex.test(user_email)) {
      return NextResponse.json(
        { message: "รูปแบบอีเมลไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    // ตรวจสอบหมายเลขโทรศัพท์ (ถ้ามีการกรอก) (อนุญาตเฉพาะตัวเลขและขีดกลาง)
    const phoneRegex = /^[0-9-]{9,20}$/;
    if (user_phone && user_phone !== "" && !phoneRegex.test(user_phone)) {
      return NextResponse.json(
        {
          message: "กรุณากรอกหมายเลขโทรศัพท์ให้ถูกต้อง (เฉพาะตัวเลขและขีดกลาง)",
        },
        { status: 400 }
      );
    }

    return await withDbConnection(async (connection) => {
      // ตรวจสอบว่ามีอีเมลซ้ำหรือไม่ (เฉพาะกรณีที่มีการกรอกอีเมล และยกเว้นผู้ใช้ปัจจุบัน)
      if (user_email && user_email !== "") {
        const [emailRows] = await connection.execute<RowDataPacket[]>(
          "SELECT COUNT(*) as count FROM user WHERE user_email = ? AND user_id != ?",
          [user_email, user_id]
        );

        if (emailRows[0]?.count > 0) {
          return NextResponse.json(
            { message: "อีเมลนี้มีอยู่ในระบบแล้ว กรุณาใช้อีเมลอื่น" },
            { status: 409 }
          );
        }
      }

      // สร้างคำสั่ง SQL สำหรับการอัพเดท
      let sql = "UPDATE user SET user_dispname = ?";
      const params = [user_dispname];

      // เพิ่มข้อมูลอีเมล (ถ้ามี)
      sql += ", user_email = ?";
      params.push(user_email || null);

      // เพิ่มข้อมูลหมายเลขโทรศัพท์ (ถ้ามี)
      sql += ", user_phone = ?";
      params.push(user_phone || null);

      // เพิ่มข้อมูลสถานะและบทบาท
      sql += ", user_active = ?, userrole_id = ?";
      params.push(user_active, userrole_id);

      // ถ้ามีการเปลี่ยนรหัสผ่าน
      if (password) {
        if (password.length < 8) {
          return NextResponse.json(
            { message: "รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร" },
            { status: 400 }
          );
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        sql += ", password = ?";
        params.push(hashedPassword);
      }

      sql += " WHERE user_id = ?";
      params.push(user_id);

      await connection.execute(sql, params);

      // log user update
      await logUserActivity({
        user_id: user.user_id,
        activity: `Updated user information (user_id: ${user_id})`,
        request,
      });

      return NextResponse.json(
        { message: "อัปเดตข้อมูลผู้ใช้สำเร็จ!" },
        { status: 200 }
      );
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดในการอัพเดทข้อมูลผู้ใช้" },
      { status: 500 }
    );
  }
}
