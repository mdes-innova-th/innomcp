import { NextRequest, NextResponse } from "next/server";
import { revokeApiKeyById } from "@/app/lib/apikey";
import { jwtMiddleware } from "@/jwtmiddleware";

// เพิกถอน API Key โดยใช้ ID
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const user = jwtResult.decoded as { userrole_id: number };
    // อนุญาตให้เฉพาะ admin (role_id = 0) เท่านั้น
    if (user.userrole_id !== 0) {
      return NextResponse.json(
        { message: "คุณไม่มีสิทธิ์เพิกถอน API Key" },
        { status: 403 }
      );
    }

    const apiKeyId = parseInt((await params).id);
    if (isNaN(apiKeyId)) {
      return NextResponse.json(
        { message: "รูปแบบ ID ไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const success = await revokeApiKeyById(apiKeyId);

    if (!success) {
      return NextResponse.json(
        { message: "ไม่พบ API Key หรือเกิดข้อผิดพลาดในการเพิกถอน" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "เพิกถอน API Key สำเร็จ" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error revoking API key:", error);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดในการเพิกถอน API Key" },
      { status: 500 }
    );
  }
}
