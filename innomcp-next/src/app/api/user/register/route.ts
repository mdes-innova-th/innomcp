import { NextRequest, NextResponse } from "next/server";
import { logUserActivity } from "@/app/lib/loguser";
import mysql, { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import bcrypt from "bcrypt";
import { jwtMiddleware } from "@/jwtmiddleware";
import { createApiKey } from "@/app/lib/apikey";

export async function POST(req: NextRequest) {
  // ตรวจสอบ JWT ด้วย jwtMiddleware
  const jwtResult = jwtMiddleware(req);
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

  let connection;

  try {
    const body = await req.json();
    const username = body.username?.trim();
    const user_dispname = body.user_dispname?.trim();
    const user_email = body.user_email?.trim();
    const user_phone = body.user_phone?.trim();
    const password = body.password?.trim();

    if (!username || !user_dispname || !user_email || !password) {
      return NextResponse.json(
        { message: "กรุณาใส่ข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    // ตรวจสอบรูปแบบของอีเมลและชื่อผู้ใช้
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const usernameRegex = /^[a-zA-Z0-9_.-]+$/;

    if (!emailRegex.test(user_email)) {
      return NextResponse.json(
        { message: "รูปแบบอีเมลไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        {
          message:
            "ชื่อผู้ใช้ต้องประกอบด้วยตัวอักษรภาษาอังกฤษ, ตัวเลข, _ , - และ . เท่านั้น",
        },
        { status: 400 }
      );
    }

    // ตรวจสอบหมายเลขโทรศัพท์ (อนุญาตเฉพาะตัวเลขและขีดกลาง)
    const phoneRegex = /^[0-9-]{9,20}$/;
    if (!user_phone || !phoneRegex.test(user_phone)) {
      return NextResponse.json(
        {
          message: "กรุณากรอกหมายเลขโทรศัพท์ให้ถูกต้อง (เฉพาะตัวเลขและขีดกลาง)",
        },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    const [usernameRows] = await connection.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM user WHERE username = ?",
      [username]
    );

    if (usernameRows[0]?.count > 0) {
      return NextResponse.json(
        { message: "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว กรุณาเลือกชื่อผู้ใช้อื่น" },
        { status: 409 }
      );
    }

    const [emailRows] = await connection.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM user WHERE user_email = ?",
      [user_email]
    );

    if (emailRows[0]?.count > 0) {
      return NextResponse.json(
        { message: "อีเมลนี้มีอยู่ในระบบแล้ว กรุณาใช้อีเมลอื่น" },
        { status: 409 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: "รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // สร้างผู้ใช้ใหม่และรับ user_id
    const [insertResult] = await connection.execute<ResultSetHeader>(
      "INSERT INTO user (username, password, user_dispname, user_email, user_phone, user_active, userrole_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        username,
        hashedPassword,
        user_dispname,
        user_email,
        user_phone,
        "1",
        "1",
      ]
    );

    const newUserId = insertResult.insertId;

    // สร้าง API Key สำหรับผู้ใช้ใหม่
    const apiKeyName = `${username}_key`;
    const apiKeyData = await createApiKey(
      apiKeyName,
      undefined, // ไม่กำหนดวันหมดอายุ
      undefined, // ไม่กำหนด rate limit
      undefined, // ไม่กำหนด allowed origins
      newUserId // ผูกกับ user_id ที่เพิ่งสร้าง
    );

    if (!apiKeyData) {
      // หากสร้าง API key ไม่สำเร็จ ลบผู้ใช้ที่เพิ่งสร้าง
      await connection.execute("DELETE FROM user WHERE user_id = ?", [
        newUserId,
      ]);
      return NextResponse.json(
        { message: "เกิดข้อผิดพลาดในการสร้าง API Key" },
        { status: 500 }
      );
    }

    // Log API key creation
    await logUserActivity({
      user_id: user.user_id,
      activity: `Created API key (${apiKeyData.apikey_name}) for user (${username}) successfully`,
      request: req,
    });

    // Log user creation
    await logUserActivity({
      user_id: newUserId,
      activity: `Created new user (${username}) successfully`,
      request: req,
    });

    return NextResponse.json(
      {
        message: "ลงทะเบียนสำเร็จ!",
        user_id: newUserId,
        api_key: apiKeyData.apikey,
        api_key_name: apiKeyData.apikey_name,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error("catch-Error:", error.message);
    } else {
      console.error("catch-Error:", error);
    }
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
