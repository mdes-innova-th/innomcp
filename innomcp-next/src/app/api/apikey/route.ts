import { NextRequest, NextResponse } from "next/server";
import { createApiKey, listApiKeys } from "@/app/lib/apikey";
import { jwtMiddleware } from "@/jwtmiddleware";
import { decryptApiKey } from "@/app/lib/apikey";

// สร้าง API Key สำหรับแอปพลิเคชัน
export async function POST(request: NextRequest) {
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
    const user = jwtResult.decoded as {
      id: number;
      username: string;
      userrole_id: number;
    };
    // ตรวจสอบว่าเป็นแอดมินหรือไม่
    if (user.userrole_id !== 0) {
      return NextResponse.json({ message: "Access denied" }, { status: 403 });
    }
    const body = await request.json();
    const { apikey_name, expire, rate_limit, allowed_origins, user_id } = body;
    if (!apikey_name) {
      return NextResponse.json(
        { message: "กรุณาระบุชื่อแอปพลิเคชันหรือเว็บไซต์" },
        { status: 400 }
      );
    }
    // สร้าง API Key ด้วยฟังก์ชันใหม่
    const expireDate = expire ? new Date(expire) : undefined;
    const apiKeyData = await createApiKey(
      apikey_name,
      expireDate,
      rate_limit,
      allowed_origins,
      user_id
    );
    if (!apiKeyData) {
      return NextResponse.json(
        { message: "เกิดข้อผิดพลาดในการสร้าง API Key" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      {
        message: "สร้าง API Key สำเร็จ",
        apiKey: apiKeyData.apikey,
        apikey_name: apiKeyData.apikey_name,
        expire: apiKeyData.expire,
        rate_limit: apiKeyData.rate_limit,
        allowed_origins: apiKeyData.allowed_origins,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating API key:", error);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดในการสร้าง API Key" },
      { status: 500 }
    );
  }
}

// ดึงรายการ API Key ทั้งหมด (สำหรับแอดมิน)
export async function GET(request: NextRequest) {
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
    const user = jwtResult.decoded as {
      id: number;
      username: string;
      userrole_id: number;
    };
    // ตรวจสอบว่าเป็นแอดมินหรือไม่
    if (user.userrole_id !== 0) {
      return NextResponse.json(
        { message: "คุณไม่มีสิทธิ์เข้าถึงการจัดการ API Key" },
        { status: 403 }
      );
    }
    // ดึงข้อมูล API Key ทั้งหมด
    const url = request.nextUrl;
    const status = url.searchParams.get("status") as
      | "active"
      | "inactive"
      | "revoke"
      | undefined;
    const apiKeyName = url.searchParams.get("name") || undefined;
    const apiKeys = await listApiKeys(status, apiKeyName);

    if (!apiKeys) {
      return NextResponse.json(
        { message: "เกิดข้อผิดพลาดในการดึงข้อมูล API Key" },
        { status: 500 }
      );
    }
    // ถอดรหัส API Key ก่อนส่งกลับ
    const decryptedApiKeys = apiKeys.map((key) => ({
      ...key,
      apikey: decryptApiKey(key.apikey),
    }));
    console.log(`Fetched API keys: ${JSON.stringify(decryptedApiKeys)}`);
    return NextResponse.json({ apiKeys: decryptedApiKeys }, { status: 200 });
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดในการดึงข้อมูล API Key" },
      { status: 500 }
    );
  }
}
