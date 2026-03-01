import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { withDbConnection } from "@/app/lib/db";
import { createApiKey } from "@/app/lib/apikey";
import { logUserActivity } from "@/app/lib/loguser";

export async function GET(request: NextRequest) {
  try {
    console.log("=== ThaiD Callback Started ===");

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // ตรวจสอบว่า state มีคำว่า "webview" หรือไม่
    const isWebView = state ? state.includes("webview") : false;

    // ใช้ชื่อ Token จาก .env
    const tokenName = process.env.TOKEN_NAME || "token";
    const isProduction = process.env.NODE_ENV === "production";

    console.log("ThaiD Callback - URL Parameters:", {
      hasCode: !!code,
      hasState: !!state,
      hasError: !!error,
      codeLength: code?.length,
      stateLength: state?.length,
      errorValue: error,
    });

    // ตรวจสอบว่ามี error จาก ThaiD หรือไม่
    if (error) {
      console.error("ThaiD OAuth error:", error);
      return NextResponse.redirect(
        `${
          process.env.NEXT_AUTH_URL || "http://localhost:3001"
        }/user/login?error=thaid_auth_failed`
      );
    }

    // ตรวจสอบว่ามี authorization code หรือไม่
    if (!code) {
      return NextResponse.redirect(
        `${
          process.env.NEXT_AUTH_URL || "http://localhost:3001"
        }/user/login?error=missing_code`
      );
    }

    // ตรวจสอบ state parameter เพื่อป้องกัน CSRF (เฉพาะกรณีที่ไม่ใช่ webview)
    if (!isWebView) {
      const storedState = request.cookies.get("cct_thaid_state")?.value;

      // ตรวจสอบ cookies ทั้งหมดที่มี
      const allCookies = Object.fromEntries(
        Array.from(request.cookies.getAll()).map((cookie) => [
          cookie.name,
          cookie.value.substring(0, 10) + "...",
        ])
      );
      console.log("ThaiD Callback - Available Cookies:", allCookies);

      // Production mode - ใช้ state validation ปกติ
      if (!state || !storedState) {
        console.error("Missing state parameter:", {
          state: !!state,
          storedState: !!storedState,
        });
        return NextResponse.redirect(
          `${
            process.env.NEXT_AUTH_URL || "http://localhost:3001"
          }/user/login?error=invalid_state`
        );
      }

      if (state !== storedState) {
        console.error("State mismatch:", {
          received: state?.substring(0, 10) + "...",
          stored: storedState?.substring(0, 10) + "...",
          receivedLength: state?.length,
          storedLength: storedState?.length,
        });
        return NextResponse.redirect(
          `${
            process.env.NEXT_AUTH_URL || "http://localhost:3001"
          }/user/login?error=invalid_state`
        );
      }
      console.log("ThaiD State validation successful");
    }

    // แลกเปลี่ยน authorization code เป็น access token
    const tokenResponse = await exchangeCodeForToken(code);
    if (!tokenResponse.access_token) {
      throw new Error("Failed to get access token from ThaiD");
    }

    console.log("ThaiD Access Token received");

    // ดึงข้อมูลผู้ใช้จาก ThaiD
    const displayName = `${tokenResponse.given_name} ${tokenResponse.family_name}`;
    const birthdate = tokenResponse.birthdate;
    console.log("ThaiD User Info:", {
      displayName,
      birthdate,
    });

    // ค้นหาหรือสร้างผู้ใช้ในฐานข้อมูล
    const result = await withDbConnection(async (connection) => {
      // ค้นหาผู้ใช้ที่มีชื่อและวันเกิดตรงกัน
      const [existingUsers] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM user WHERE user_dispname = ? AND user_birthdate = ?",
        [displayName, birthdate]
      );

      let user;
      if (existingUsers.length > 0) {
        // ผู้ใช้มีอยู่แล้ว
        user = existingUsers[0];
        console.log("Existing user found");
        // log การเข้าสู่ระบบสำเร็จ
        await logUserActivity({
          user_id: user.user_id,
          activity: `Login displayName: ${user.user_dispname} username: ${user.username}`,
          request,
        });
      } else {
        // สร้างผู้ใช้ใหม่
        console.log("Creating new user");
        const displayName = `${tokenResponse.given_name} ${tokenResponse.family_name}`;

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
          throw new Error("มีผู้ใช้ที่ใช้ชื่อนี้มากเกินไป");
        }

        // สร้าง username จาก UUID เสมอ
        const finalUsername = `thaid-${uuidv4()
          .replace(/-/g, "")
          .substring(0, 16)}`;

        // สร้างรหัสผ่านอัตโนมัติ
        const generatedPassword = uuidv4().replace(/-/g, "").substring(0, 16);
        const hashedPassword = await bcrypt.hash(generatedPassword, 10);

        const [insertResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO user (username, password, user_dispname, user_active, userrole_id, user_birthdate) 
           VALUES (?, ?, ?, '1', 1, ?)`,
          [finalUsername, hashedPassword, displayName, birthdate || null]
        );

        const userId = insertResult.insertId;
        console.log(
          `New user created with ID: ${userId}, Username: ${finalUsername}`
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
            `Failed to create API key for ThaiD user: ${finalUsername}`
          );
          console.log("Creating the user was aborted");
          throw new Error("เกิดข้อผิดพลาดในการสร้าง API Key");
        }

        // Log API key creation
        await logUserActivity({
          user_id: userId,
          activity: `Created API key (${apiKeyData.apikey_name}) for user (${finalUsername}) successfully`,
          request,
        });

        // บันทึก log การสร้าง user อัตโนมัติสำเร็จ
        console.log(
          `Auto-registered ThaiID user: ID=${userId}, Name=${displayName}, Username=${finalUsername}, Birthdate=${birthdate}, Date=${new Date().toISOString()}, API Key: ${
            apiKeyData.apikey_name
          }`
        );

        // log การสร้าง user ใหม่
        await logUserActivity({
          user_id: userId,
          activity: `Created new user displayName: ${displayName} username: ${finalUsername}`,
          request,
        });
        // ดึงข้อมูลผู้ใช้ที่เพิ่งสร้าง
        const [newUsers] = await connection.execute<RowDataPacket[]>(
          "SELECT * FROM user WHERE user_id = ?",
          [userId]
        );
        user = newUsers[0];
      }

      // สร้าง JWT token
      const token = jwt.sign(
        {
          user_id: user.user_id,
          username: user.username,
          user_dispname: user.user_dispname,
          userrole_id: user.userrole_id,
        },
        process.env.JWT_SECRET!,
        { expiresIn: "48h" }
      );

      return { token, user };
    });

    // เปิด deeplink แอป CCT ทันที กรณี webview
    if (isWebView) {
      console.log("Handling WebView redirect");
      return handleWebViewRedirect(result.token, "bear" + "er", 60 * 60 * 24 * 2);
    }

    // สร้าง response และ set cookie
    const response = NextResponse.redirect(
      `${process.env.NEXT_AUTH_URL || "http://localhost:3001"}/reportsite`
    );

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

    response.cookies.set(tokenName, result.token, tokenCookieOptions);

    // ลบ state cookie
    const deleteCookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 0,
      ...(isProduction && {
        domain: process.env.COOKIE_DOMAIN || ".dataxo.info",
      }),
    };

    response.cookies.set("cct_thaid_state", "", deleteCookieOptions);

    console.log("ThaiD Callback - Success:", {
      userId: result.user.user_id,
      username: result.user.username,
      redirectUrl: response.headers.get("location"),
      tokenCookieSet: true,
      stateCookieDeleted: true,
    });

    return response;
  } catch (error) {
    console.error("ThaiD callback error:", error);

    // Log detailed error information
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    // ลบ state cookie เมื่อเกิด error
    const response = NextResponse.redirect(
      `${
        process.env.NEXT_AUTH_URL || "http://localhost:3001"
      }/user/login?error=thaid_callback_failed`
    );

    const isProduction = process.env.NODE_ENV === "production";
    const deleteCookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 0,
      ...(isProduction && {
        domain: process.env.COOKIE_DOMAIN || ".dataxo.info",
      }),
    };

    response.cookies.set("cct_thaid_state", "", deleteCookieOptions);

    return response;
  }
}

///////////////////////////////////////////////

// ฟังก์ชันแลกเปลี่ยน authorization code เป็น access token
async function exchangeCodeForToken(code: string) {
  const tokenUrl = process.env.THAID_TOKEN_URL;
  const clientId = process.env.THAID_CLIENT_ID;
  const clientSecret = process.env.THAID_CLIENT_SECRET;
  const redirectUri = `${
    process.env.NEXT_AUTH_URL || "http://localhost:3001"
  }/api/user/login/thaid/callback`;

  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error("Missing ThaiD client credentials or token URL");
  }

  try {
    console.log("Exchanging code for token");
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        authorization: `Basic ${Buffer.from(
          `${clientId}:${clientSecret}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    console.log("Token exchange successful");
    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Token exchange timeout");
    }
    throw error;
  }
}

async function handleWebViewRedirect(
  token: string,
  tokenType: string,
  expiresIn: number
) {
  const deeplink =
    `${process.env.CCT_DEEPLINK}?${process.env.TOKEN_NAME}=${token}&token_type=${tokenType}&expires_in=${expiresIn}` ||
    "http://localhost:3001";
  return NextResponse.redirect(deeplink);
}
