
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

export function jwtMiddleware(req: NextRequest) {
  const tokenName = process.env.TOKEN_NAME || "token";
  const token = req.cookies.get(tokenName)?.value;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized: No token found" }, { status: 401 });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    if (typeof decoded !== "object" || decoded === null) {
      throw new Error("Invalid token payload");
    }
    // สามารถ return decoded หรือ NextResponse.next() ได้ตามต้องการ
    return { valid: true, decoded };
  } catch {
    return NextResponse.json({ message: "Unauthorized: Invalid or expired token" }, { status: 401 });
  }
}
