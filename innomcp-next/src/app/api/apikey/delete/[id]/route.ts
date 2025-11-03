import { NextRequest, NextResponse } from "next/server";
import { deleteApiKey } from "@/app/lib/apikey";
import { jwtMiddleware } from "@/jwtmiddleware";

// ลบ API Key อย่างถาวร
export async function DELETE(
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

    const success = await deleteApiKey(apiKeyId);

    if (!success) {
      return NextResponse.json(
        { message: "ไม่พบ API Key หรือเกิดข้อผิดพลาดในการลบ" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "ลบ API Key สำเร็จ" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting API key:", error);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดในการลบ API Key" },
      { status: 500 }
    );
  }
}
