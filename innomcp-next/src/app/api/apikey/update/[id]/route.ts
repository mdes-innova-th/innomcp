import { NextRequest, NextResponse } from "next/server";
import { updateApiKey } from "@/app/lib/apikey";
import { jwtMiddleware } from "@/jwtmiddleware";

// อัปเดตข้อมูล API Key
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

    const apiKeyId = parseInt((await params).id, 10);
    if (isNaN(apiKeyId)) {
      return NextResponse.json(
        { message: "รูปแบบ ID ไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    // รับข้อมูลที่ต้องการอัปเดตจาก request body
    const data = await request.json();
    const { apikey_name, expire, rate_limit, allowed_origins, user_id } = data;

    // ตรวจสอบความถูกต้องของข้อมูล
    if (!apikey_name || apikey_name.trim() === "") {
      return NextResponse.json(
        { message: "กรุณาระบุชื่อ API Key" },
        { status: 400 }
      );
    }

    // เตรียมข้อมูลสำหรับการอัปเดต
    const updateData: {
      apikey_name: string;
      expire?: Date | null;
      rate_limit?: number | null;
      allowed_origins?: string | null;
      user_id?: number | null;
    } = {
      apikey_name: apikey_name.trim(),
    };

    // หากมีการระบุวันหมดอายุ
    if (expire !== undefined) {
      updateData.expire = expire ? new Date(expire) : null;
    }

    // หากมีการระบุ rate_limit
    if (rate_limit !== undefined) {
      updateData.rate_limit = rate_limit ? parseInt(rate_limit) : null;
    }

    // หากมีการระบุ allowed_origins
    if (allowed_origins !== undefined) {
      updateData.allowed_origins = allowed_origins
        ? allowed_origins.trim()
        : null;
    }

    // หากมีการระบุ user_id
    if (user_id !== undefined) {
      updateData.user_id = user_id ? parseInt(user_id) : null;
    }

    const success = await updateApiKey(apiKeyId, updateData);

    if (!success) {
      return NextResponse.json(
        { message: "ไม่พบ API Key หรือเกิดข้อผิดพลาดในการอัปเดต" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "อัปเดต API Key สำเร็จ" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating API key:", error);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดในการอัปเดต API Key" },
      { status: 500 }
    );
  }
}
