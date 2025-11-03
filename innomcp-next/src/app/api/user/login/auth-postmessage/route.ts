import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
// jwt not required for incoming verification in this endpoint
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { withDbConnection } from "@/app/lib/db";
import { createApiKey, validateApiKey } from "@/app/lib/apikey";
import { verifyCSRFToken } from "@/utils/verifyCSRFToken";
import { logUserActivity } from "@/app/lib/loguser";

// Interface สำหรับ request body
interface PostMessageLoginRequest {
  firstName: string;
  lastName: string;
  birthDate: string;
  appid?: string;
  apiKey?: string;
}

// Interface สำหรับ JWT payload
// (no JwtPayload required)

export async function POST(request: NextRequest) {
  try {
    console.log("=== Post Message Login Started ===");

    // ตรวจสอบ CSRF token ก่อนดำเนินการ
    await verifyCSRFToken(request);

    // ดึงข้อมูลจาก request body
    const body: PostMessageLoginRequest = await request.json();
    const { firstName, lastName, birthDate, appid, apiKey } = body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!firstName || !lastName || !birthDate) {
      console.error("Post Message Login - Missing required fields:", {
        hasFirstName: !!firstName,
        hasLastName: !!lastName,
        hasBirthDate: !!birthDate,
      });
      await logUserActivity({
        user_id: 0,
        activity: `Post Message Login - Missing required parameters`,
        request,
      });
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // If appid/apiKey are provided, validate them against .env (optional) and the apikey table
    if (appid !== undefined || apiKey !== undefined) {
      // require both when one is present
      if (!appid || !apiKey) {
        console.error(
          "Post Message Login - appid and apiKey must both be provided when using app authentication",
          { appid, hasApiKey: !!apiKey }
        );
        await logUserActivity({
          user_id: 0,
          activity: `Post Message Login - appid and apiKey are required together`,
          request,
        });
        return NextResponse.json(
          { error: "appid and apiKey are required together" },
          { status: 400 }
        );
      }

      // Check against optional environment variable (if set)
      const expectedAppId =
        process.env.POSTMESSAGE_APPID ||
        process.env.NEXT_PUBLIC_POSTMESSAGE_APPID;
      if (expectedAppId) {
        if (appid !== expectedAppId) {
          console.error(
            "Post Message Login - appid does not match configured POSTMESSAGE_APPID",
            { provided: appid, expected: expectedAppId }
          );
          await logUserActivity({
            user_id: 0,
            activity: `Post Message Login - appid does not match configured POSTMESSAGE_APPID`,
            request,
          });
          return NextResponse.json({ error: "Invalid appid" }, { status: 401 });
        }
      } else {
        console.log(
          "Post Message Login - no POSTMESSAGE_APPID configured in .env; skipping env check"
        );
      }

      // Validate apiKey against database using helper (this will decrypt stored keys and compare)
      try {
        const validation = await validateApiKey(
          apiKey,
          request.headers.get("origin") || undefined
        );
        if (!validation.valid || !validation.apiKeyData) {
          console.error("Post Message Login - API key validation failed", {
            error: validation.error,
          });
          await logUserActivity({
            user_id: 0,
            activity: `Post Message Login - API key validation failed`,
            request,
          });
          return NextResponse.json(
            { error: "Invalid API key" },
            { status: 401 }
          );
        }

        // Ensure the apikey_name stored in DB matches provided appid
        if (validation.apiKeyData.apikey_name !== appid) {
          console.error(
            "Post Message Login - provided appid does not match apikey record",
            { providedAppId: appid, dbName: validation.apiKeyData.apikey_name }
          );
          await logUserActivity({
            user_id: 0,
            activity: `Post Message Login - provided appid does not match apikey record`,
            request,
          });
          return NextResponse.json(
            { error: "appid does not match API key record" },
            { status: 401 }
          );
        }

        console.log(
          "Post Message Login - appid and apiKey validated against database",
          { apikey_id: validation.apiKeyData.apikey_id }
        );
      } catch (valErr) {
        console.error("Post Message Login - error validating API key:", valErr);
        await logUserActivity({
          user_id: 0,
          activity: `Post Message Login - error validating API key`,
          request,
        });
        return NextResponse.json(
          { error: "Error validating API key" },
          { status: 500 }
        );
      }
    }

    // ตรวจสอบรูปแบบวันเกิด
    const birthDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!birthDateRegex.test(birthDate)) {
      console.error("Invalid birth date format:", birthDate);
      return NextResponse.json(
        { error: "Invalid birth date format. Expected YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // ตรวจสอบอายุ (18-120 ปี)
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }

    if (birth > today) {
      console.error("Birth date is in the future:", birthDate);
      return NextResponse.json(
        { error: "Birth date cannot be in the future" },
        { status: 400 }
      );
    }

    if (age < 18) {
      console.error("User is under 18 years old:", age);
      return NextResponse.json(
        { error: "User must be at least 18 years old" },
        { status: 400 }
      );
    }

    if (age > 120) {
      console.error("User age is over 120:", age);
      return NextResponse.json({ error: "Invalid age" }, { status: 400 });
    }

    // สร้าง displayName
    const displayName = `${firstName.trim()} ${lastName.trim()}`;

    console.log("Post Message Login - User Info:", {
      displayName,
      birthDate,
      age,
    });

    // ค้นหาหรือสร้างผู้ใช้ในฐานข้อมูล
    const result = await withDbConnection(async (connection) => {
      // ค้นหาผู้ใช้ที่มีชื่อและวันเกิดตรงกัน
      const [existingUsers] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM user WHERE user_dispname = ? AND user_birthdate = ?",
        [displayName, birthDate]
      );

      let user;
      if (existingUsers.length > 0) {
        // ผู้ใช้มีอยู่แล้ว
        user = existingUsers[0];
        console.log("Post Message Login - Existing user found:", {
          userId: user.user_id,
          username: user.username,
        });
        await logUserActivity({
          user_id: user.user_id,
          activity: `Post Message Login - Existing user login`,
          request,
        });
      } else {
        // สร้างผู้ใช้ใหม่
        console.log("Post Message Login - Creating new user");

        // ตรวจสอบการสร้าง user ซ้ำ (จำกัดไม่เกิน 10 user ต่อชื่อ)
        const [existingUsersByName] = await connection.execute<RowDataPacket[]>(
          "SELECT COUNT(*) as count FROM user WHERE user_dispname = ?",
          [displayName]
        );

        const existingUserCount = existingUsersByName[0].count;
        if (existingUserCount >= 10) {
          console.log(
            `Too many users with the same name: ${displayName} (${existingUserCount} users)`
          );
          throw new Error("Too many users with the same name");
        }

        // สร้าง username จาก UUID เสมอ
        const finalUsername = `webd-${uuidv4()
          .replace(/-/g, "")
          .substring(0, 16)}`;

        // สร้างรหัสผ่านอัตโนมัติ
        const generatedPassword = uuidv4().replace(/-/g, "").substring(0, 16);
        const hashedPassword = await bcrypt.hash(generatedPassword, 10);

        const [insertResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO user (username, password, user_dispname, user_active, userrole_id, user_birthdate) 
           VALUES (?, ?, ?, '1', 1, ?)`,
          [finalUsername, hashedPassword, displayName, birthDate]
        );

        const userId = insertResult.insertId;
        console.log(
          `Post Message Login - New user created with ID: ${userId}, Username: ${finalUsername}`
        );

        // สร้าง API Key สำหรับผู้ใช้ใหม่
        const apiKeyName = `${finalUsername}_key`;
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
          console.log(
            `Failed to create API key for Post Message user: ${finalUsername}`
          );
          console.log("Creating the user was aborted");
          throw new Error("Failed to create API Key for new user");
        }

        // บันทึก log การสร้าง user อัตโนมัติสำเร็จ
        await logUserActivity({
          user_id: userId,
          activity: `Auto-registered Post Message user: Name=${displayName}, Username=${finalUsername}, Birthdate=${birthDate}, API Key: ${apiKeyData.apikey_name}`,
          request,
        });
        console.log(
          `Auto-registered Post Message user: ID=${userId}, Name=${displayName}, Username=${finalUsername}, Birthdate=${birthDate}, Date=${new Date().toISOString()}, API Key: ${
            apiKeyData.apikey_name
          }`
        );

        // ดึงข้อมูลผู้ใช้ที่เพิ่งสร้าง
        const [newUsers] = await connection.execute<RowDataPacket[]>(
          "SELECT * FROM user WHERE user_id = ?",
          [userId]
        );
        user = newUsers[0];
      }

      // ก่อนสร้าง JWT session ตรวจสอบสถานะผู้ใช้ (ต้องมีอยู่และ active)
      if (!user) {
        console.error(
          "Post Message Login - user lookup failed: no user returned from DB"
        );
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // user_active ในฐานข้อมูล อาจเก็บเป็นตัวเลขหรือสตริง '1'
      const isActive =
        user.user_active === 1 ||
        user.user_active === "1" ||
        user.user_active === true;

      if (!isActive) {
        console.error(
          "Post Message Login - user is not active, aborting token creation",
          {
            userId: user.user_id,
            user_active: user.user_active,
          }
        );
        return NextResponse.json(
          { error: "User account is not active" },
          { status: 403 }
        );
      }

      // สร้าง JWT token สำหรับ session
      const sessionToken = jwt.sign(
        {
          user_id: user.user_id,
          username: user.username,
          user_dispname: user.user_dispname,
          userrole_id: user.userrole_id,
        },
        process.env.JWT_SECRET!,
        { expiresIn: "48h" }
      );

      return { token: sessionToken, user };
    });

    // ตรวจสอบผลลัพธ์จากฐานข้อมูลว่ามี token และ user ก่อนดำเนินการต่อ
    if (
      !result ||
      typeof result !== "object" ||
      !("token" in result) ||
      !("user" in result)
    ) {
      console.error("Post Message Login - invalid result from DB operation", {
        result,
      });
      return NextResponse.json(
        { error: "Internal server error during Post Message login" },
        { status: 500 }
      );
    }

    type DbResult = {
      token: string;
      user: RowDataPacket & Record<string, unknown>;
    };
    const finalResult = result as unknown as DbResult;
    const finalToken: string = finalResult.token;
    const finalUser: RowDataPacket & Record<string, unknown> = finalResult.user;

    // ใช้ชื่อ Token จาก .env
    const tokenName = process.env.TOKEN_NAME || "token";
    const isProduction = process.env.NODE_ENV === "production";

    // สร้าง response และ set cookie (ไม่จำเป็นต้องจัดการ WebView)
    const response = NextResponse.json({
      success: true,
      message: "Login successful",
      user: {
        user_id: finalUser.user_id,
        username: finalUser.username,
        user_dispname: finalUser.user_dispname,
        userrole_id: finalUser.userrole_id,
      },
    });

    const tokenCookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict" as const,
      path: "/",
      maxAge: 60 * 60 * 24 * 2, // 48 hours
      ...(isProduction && {
        domain: process.env.COOKIE_DOMAIN || ".dataxo.info",
      }),
    };

    response.cookies.set(tokenName, finalToken, tokenCookieOptions);

    console.log("Post Message Login - Success:", {
      userId: finalUser.user_id,
      username: finalUser.username,
      tokenCookieSet: true,
    });

    await logUserActivity({
      user_id: finalUser.user_id,
      activity: `Post Message Login - Success`,
      request,
    });
    return response;
  } catch (error) {
    console.error("Post Message Login error:", error);

    // Log detailed error information
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    return NextResponse.json(
      { error: "Internal server error during Post Message login" },
      { status: 500 }
    );
  }
}
