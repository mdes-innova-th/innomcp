import { NextResponse } from "next/server";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { verifyCSRFToken } from "@/utils/verifyCSRFToken";
import { withDbConnection } from "@/app/lib/db";
import { createApiKey } from "@/app/lib/apikey";
import { logUserActivity } from "@/app/lib/loguser";

export async function POST(req: Request) {
  try {
    // ตรวจสอบ CSRF token ก่อนดำเนินการ
    await verifyCSRFToken(req);

    const body = await req.json();
    const displayName = body.displayName?.trim();
    const birthDate = body.birthDate?.trim();

    // ตรวจสอบข้อมูลพื้นฐาน
    if (!displayName || !birthDate) {
      return NextResponse.json(
        { message: "กรุณากรอกชื่อและวันเกิดให้ครบถ้วน" },
        { status: 400 }
      );
    }

    // ตรวจสอบความยาวชื่อ
    if (displayName.length < 2 || displayName.length > 100) {
      return NextResponse.json(
        { message: "ชื่อต้องมีความยาวระหว่าง 2-100 ตัวอักษร" },
        { status: 400 }
      );
    }

    // ตรวจสอบรูปแบบชื่อ (อนุญาตเฉพาะตัวอักษร ตัวเลข ช่องว่าง จุด ขีด)
    const nameRegex = /^[a-zA-Z0-9ก-๙\s.\-]+$/;
    if (!nameRegex.test(displayName)) {
      return NextResponse.json(
        { message: "ชื่อประกอบด้วยอักขระที่ไม่ได้รับอนุญาต" },
        { status: 400 }
      );
    }

    // ตรวจสอบวันเกิด
    const today = new Date();
    const birth = new Date(birthDate);

    if (isNaN(birth.getTime())) {
      return NextResponse.json(
        { message: "รูปแบบวันเกิดไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    if (birth > today) {
      return NextResponse.json(
        { message: "วันเกิดไม่สามารถเป็นวันที่ในอนาคต" },
        { status: 400 }
      );
    }

    // ตรวจสอบอายุ (13-120 ปี)
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }

    if (age < 13) {
      return NextResponse.json(
        { message: "ต้องมีอายุอย่างน้อย 13 ปี" },
        { status: 400 }
      );
    }

    if (age > 120) {
      return NextResponse.json(
        { message: "อายุไม่สามารถเกิน 120 ปี" },
        { status: 400 }
      );
    }

    // ใช้ withDbConnection เพื่อจัดการการเชื่อมต่อฐานข้อมูล
    const result = await withDbConnection(async (connection) => {
      // ค้นหาผู้ใช้จากชื่อและวันเกิด
      const [rows] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM user WHERE user_dispname = ? AND user_birthdate = ?",
        [displayName, birthDate]
      );

      if (rows.length === 0) {
        // ตรวจสอบการสร้าง user ซ้ำในวันเดียวกัน (จำกัดไม่เกิน 5 ครั้งต่อชื่อต่อวัน)
        // ใช้การตรวจสอบจากจำนวน user ที่มีชื่อเดียวกันแทน เนื่องจากไม่มี user_created field
        const [existingUsers] = await connection.execute<RowDataPacket[]>(
          "SELECT COUNT(*) as count FROM user WHERE user_dispname = ?",
          [displayName]
        );

        const existingUserCount = existingUsers[0].count;
        if (existingUserCount >= 10) {
          // จำกัดไม่เกิน 10 user ต่อชื่อ
          console.log(
            `Too many users with the same name: ${displayName} (${existingUserCount} users)`
          );
          return NextResponse.json(
            {
              message:
                "มีผู้ใช้ที่ใช้ชื่อนี้มากเกินไป กรุณาใช้ชื่อที่แตกต่างกัน",
            },
            { status: 429 }
          );
        }

        // ไม่พบข้อมูลผู้ใช้ ทำการลงทะเบียนอัตโนมัติ
        // สร้าง username อัตโนมัติโดยใช้ uuid และตรวจสอบความซ้ำ
        let generatedUsername: string;
        let isUsernameUnique = false;
        let attempts = 0;
        const maxAttempts = 10; // จำกัดจำนวนครั้งในการลองสร้าง username

        do {
          generatedUsername = `name-${uuidv4()
            .replace(/-/g, "")
            .substring(0, 16)}`;

          // ตรวจสอบว่า username นี้มีอยู่ในฐานข้อมูลแล้วหรือไม่
          const [existingUsername] = await connection.execute<RowDataPacket[]>(
            "SELECT COUNT(*) as count FROM user WHERE username = ?",
            [generatedUsername]
          );

          isUsernameUnique = existingUsername[0].count === 0;
          attempts++;

          if (attempts >= maxAttempts && !isUsernameUnique) {
            // ถ้าลองแล้ว maxAttempts ครั้งแล้วยังไม่ได้ username ที่ไม่ซ้ำ ให้ใช้ timestamp เพิ่มเติม
            generatedUsername = `name-${uuidv4()
              .replace(/-/g, "")
              .substring(0, 16)}_${Date.now().toString().slice(-4)}`;

            // ตรวจสอบอีกครั้งสำหรับ username ที่มี timestamp
            const [finalCheck] = await connection.execute<RowDataPacket[]>(
              "SELECT COUNT(*) as count FROM user WHERE username = ?",
              [generatedUsername]
            );

            isUsernameUnique = finalCheck[0].count === 0;
            break;
          }
        } while (!isUsernameUnique && attempts < maxAttempts);

        if (!isUsernameUnique) {
          console.error(
            `Failed to generate unique username after ${attempts} attempts`
          );
          return NextResponse.json(
            {
              message: "เกิดข้อผิดพลาดในการสร้าง username กรุณาลองใหม่อีกครั้ง",
            },
            { status: 500 }
          );
        }

        // สร้างรหัสผ่านอัตโนมัติ (สามารถเปลี่ยนในภายหลัง)
        const generatedPassword = uuidv4().replace(/-/g, "").substring(0, 16);

        const hashedPassword = await bcrypt.hash(generatedPassword, 10);

        // เพิ่มข้อมูลผู้ใช้ใหม่ลงในฐานข้อมูล
        const [result] = await connection.execute<ResultSetHeader>(
          "INSERT INTO user (username, password, user_dispname, user_birthdate, user_active, userrole_id) VALUES (?, ?, ?, ?, ?, ?)",
          [generatedUsername, hashedPassword, displayName, birthDate, "1", "1"]
        );

        const userId = result.insertId;

        // log การสร้าง user ใหม่
        await logUserActivity({
          user_id: userId,
          activity: `Created new user displayName: ${displayName} username: ${generatedUsername}`,
          request: req,
        });

        // สร้าง API Key สำหรับผู้ใช้ใหม่
        const apiKeyName = `${generatedUsername}_key`;
        const apiKeyData = await createApiKey(
          apiKeyName,
          undefined, // ไม่กำหนดวันหมดอายุ
          undefined, // ไม่กำหนด rate limit
          undefined, // ไม่กำหนด allowed origins
          userId // ผูกกับ user_id ที่เพิ่งสร้าง
        );

        if (!apiKeyData) {
          // หากสร้าง API key ไม่สำเร็จ ลบผู้ใช้ที่เพิ่งสร้าง
          await connection.execute("DELETE FROM user WHERE user_id = ?", [
            userId,
          ]);
          console.error(
            `Failed to create API key for user: ${generatedUsername}`
          );
          return NextResponse.json(
            { message: "เกิดข้อผิดพลาดในการสร้าง API Key" },
            { status: 500 }
          );
        }

        // Log API key creation
        await logUserActivity({
          user_id: userId,
          activity: `Created API key (${apiKeyData.apikey_name}) for user (${generatedUsername}) successfully`,
          request: req,
        });

        // บันทึก log การสร้าง user อัตโนมัติ
        console.log(
          `Auto-registered user: ID=${userId}, Name=${displayName}, Username=${generatedUsername}, Age=${age}, Date=${new Date().toISOString()}, API Key: ${
            apiKeyData.apikey_name
          }`
        );

        // Generate JWT สำหรับผู้ใช้ที่ลงทะเบียนใหม่
        const token = jwt.sign(
          {
            user_id: userId,
            username: generatedUsername,
            user_dispname: displayName,
            userrole_id: 1,
          },
          process.env.JWT_SECRET!,
          { expiresIn: "48h" } // 48 hours
        );

        return {
          token,
          message: "ลงทะเบียนและเข้าสู่ระบบสำเร็จ",
          newUser: true,
        };
      }

      const user = rows[0];

      // log การเข้าสู่ระบบสำเร็จ
      await logUserActivity({
        user_id: user.user_id,
        activity: `Login displayName: ${user.user_dispname} username: ${user.username}`,
        request: req,
      });

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

    // ตรวจสอบว่า result มี token หรือไม่
    if (!("token" in result) || !result.token) {
      return NextResponse.json(
        { message: "เกิดข้อผิดพลาดในการสร้าง token" },
        { status: 500 }
      );
    }

    // ตรวจสอบว่าเป็นผู้ใช้ใหม่หรือไม่
    const isNewUser = "newUser" in result && result.newUser === true;

    // Set HttpOnly cookie
    const response = NextResponse.json(
      {
        message: result.message,
        isNewUser: isNewUser || false,
      },
      { status: isNewUser ? 201 : 200 }
    );

    // ใช้ชื่อ Token จาก .env
    const tokenName = process.env.TOKEN_NAME || "token";
    response.cookies.set(tokenName, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 172800, // 48 hours in seconds
      path: "/",
      ...(process.env.NODE_ENV === "production" && {
        domain: process.env.COOKIE_DOMAIN || ".dataxo.info",
      }),
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" },
      { status: 500 }
    );
  }
}
