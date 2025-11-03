import { NextResponse } from "next/server";
import { RowDataPacket } from "mysql2/promise";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { verifyCSRFToken } from "@/utils/verifyCSRFToken";
import { withDbConnection } from "@/app/lib/db";

export async function POST(req: Request) {
  try {
    // ตรวจสอบ CSRF token ก่อนดำเนินการ
    await verifyCSRFToken(req);

    const body = await req.json();

    const username = body.username?.trim();
    const password = body.password?.trim();

    if (!username || !password) {
      return NextResponse.json(
        { message: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    // ใช้ withDbConnection เพื่อจัดการการเชื่อมต่อฐานข้อมูล
    const result = await withDbConnection(async (connection) => {
      const [rows] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM user WHERE username = ? OR user_email = ?",
        [username, username]
      );

      if (rows.length === 0) {
        return { error: "USER_NOT_FOUND" };
      }

      const user = rows[0];

      try {
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
          return { error: "INVALID_PASSWORD" };
        }
      } catch (bcryptError) {
        console.error("Password validation error:", bcryptError);
        return { error: "PASSWORD_VALIDATION_ERROR" };
      }

      // Generate JWT
      const token = jwt.sign(
        {
          user_id: user.user_id,
          username: user.username,
          user_dispname: user.user_dispname,
          userrole_id: user.userrole_id,
        },
        process.env.JWT_SECRET!,
        { expiresIn: "48h" } // 48 hours
      );

      return { token, message: "เข้าสู่ระบบสำเร็จ" };
    });

    // ตรวจสอบผลลัพธ์และส่ง response
    if ("error" in result) {
      if (result.error === "USER_NOT_FOUND") {
        return NextResponse.json(
          { message: "อีเมลหรือชื่อผู้ใช้ไม่ถูกต้อง" },
          { status: 401 }
        );
      } else if (result.error === "INVALID_PASSWORD") {
        return NextResponse.json(
          { message: "รหัสผ่านไม่ถูกต้อง" },
          { status: 401 }
        );
      } else if (result.error === "PASSWORD_VALIDATION_ERROR") {
        return NextResponse.json(
          { message: "ไม่สามารถตรวจสอบรหัสผ่านได้ กรุณาลองใหม่อีกครั้ง" },
          { status: 500 }
        );
      }
    }

    // ตรวจสอบว่า result มี token หรือไม่
    if (!("token" in result) || !result.token) {
      return NextResponse.json(
        { message: "เกิดข้อผิดพลาดในการสร้าง token" },
        { status: 500 }
      );
    }

    // Set HttpOnly cookie
    const response = NextResponse.json(
      { message: result.message },
      { status: 200 }
    );

    // ใช้ชื่อ Token จาก .env
    const tokenName = process.env.TOKEN_NAME || "token";
    response.cookies.set(tokenName, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 2, // 48 hours
      ...(process.env.NODE_ENV === "production" && {
        domain: process.env.COOKIE_DOMAIN || ".dataxo.info",
      }),
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);

    // จัดการข้อผิดพลาดที่เฉพาะเจาะจง
    if (error instanceof Error) {
      const errorMessage = error.message;

      if (
        errorMessage.toLowerCase().includes("connect") ||
        errorMessage.toLowerCase().includes("connection")
      ) {
        console.error("Database connection error:", errorMessage);
        return NextResponse.json(
          { message: "ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้ กรุณาลองใหม่ภายหลัง" },
          { status: 503 }
        );
      } else if (errorMessage.toLowerCase().includes("timeout")) {
        console.error("Database timeout error:", errorMessage);
        return NextResponse.json(
          {
            message:
              "การเชื่อมต่อกับฐานข้อมูลใช้เวลานานเกินไป กรุณาลองใหม่ภายหลัง",
          },
          { status: 504 }
        );
      } else {
        console.error("Unexpected error:", errorMessage);
      }
    } else {
      console.error("Unknown error:", error);
    }

    return NextResponse.json(
      { message: "มีปัญหาในระบบ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
