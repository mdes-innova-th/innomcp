import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { logUserActivity } from "@/app/lib/loguser";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    // ใช้ชื่อ token จาก .env
    const tokenName = process.env.TOKEN_NAME || "token";
    // ดึง token จาก cookies
    const token = cookieStore.get(tokenName)?.value;

    // หากไม่มี token
    if (!token) {
      return NextResponse.json(
        { message: "Unauthorized: No token found" },
        { status: 401 }
      );
    }

    // ตรวจสอบความถูกต้องของ token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!); // ตรวจสอบ payload ของ token
    if (typeof decoded !== "object" || decoded === null) {
      throw new Error("Invalid token payload");
    } // หาก token ถูกต้อง ส่ง response พร้อมข้อมูลผู้ใช้แต่ไม่รวม token

    // กำหนด interface สำหรับข้อมูลที่ถอดรหัสมาจาก token
    interface DecodedToken {
      user_dispname?: string;
      user_id?: number;
      userrole_id?: number;
      username?: string;
      [key: string]: unknown;
    }

    const typedDecoded = decoded as DecodedToken;

    // log user activity
    if (typedDecoded.user_id) {
      await logUserActivity({
        user_id: typedDecoded.user_id,
        activity: "Login/Authenticated",
        request: request,
      });
    }
    // ส่งเฉพาะข้อมูลที่จำเป็นกลับไป โดยไม่ส่ง token
    return NextResponse.json(
      {
        message: "Authenticated",
        user: {
          user_dispname: typedDecoded.user_dispname,
          user_id: typedDecoded.user_id,
          userrole_id: typedDecoded.userrole_id,
          // ส่งเฉพาะข้อมูลที่จำเป็นอื่นๆ
        },
      },
      { status: 200 }
    );
  } catch (error) {
    // จับข้อผิดพลาดและส่ง Unauthorized
    console.error("catch-Authentication error:", error);
    return NextResponse.json(
      { message: "Unauthorized: Invalid or expired token" },
      { status: 401 }
    );
  }
}
