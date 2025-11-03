import { NextResponse, NextRequest } from "next/server";
import { jwtMiddleware } from "@/jwtmiddleware";
import { logUserActivity } from "@/app/lib/loguser";

export async function POST(request: Request) {
  try {
    // อ่าน JWT
    const jwtResult = jwtMiddleware(
      request instanceof NextRequest ? request : new NextRequest(request)
    );
    let userId = 0;
    if (jwtResult instanceof NextResponse) {
      // กรณี JWT ไม่ถูกต้องหรือหมดอายุ
      return jwtResult;
    }
    if (
      jwtResult &&
      jwtResult.valid &&
      jwtResult.decoded &&
      typeof jwtResult.decoded === "object"
    ) {
      userId = jwtResult.decoded.user_id || 0;
    }

    // Clear the authentication cookie
    const response = NextResponse.json({ message: "Logged out successfully" });
    // ใช้ชื่อ token จาก .env
    const tokenName = process.env.TOKEN_NAME || "token";
    // ลบ cookie โดยตั้งค่า maxAge เป็น 0
    response.cookies.set(tokenName, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0, // Expire immediately
      path: "/",
      ...(process.env.NODE_ENV === "production" && {
        domain: process.env.COOKIE_DOMAIN || ".dataxo.info",
      }),
    });

    // log กิจกรรม logout พร้อม user_id
    await logUserActivity({
      user_id: userId,
      activity: "Logout/Cookie cleared",
      request,
    });

    return response;
  } catch (error) {
    console.error("Error during logout:", error);
    return NextResponse.json({ error: "Failed to log out" }, { status: 500 });
  }
}
