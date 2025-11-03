// CSRF logic removed; file intentionally left blank.
import { cookies } from "next/headers";
import crypto from "crypto";

/**
 * ตรวจสอบ CSRF token จาก request header และ cookie
 * @param req Request object
 * @returns true ถ้าตรวจสอบผ่าน, otherwise throw error
 */
export async function verifyCSRFToken(req: Request) {
  const cookieStore = await cookies();
  const csrfCookie = cookieStore.get("csrf_token")?.value;
  const csrfHeader = req.headers.get("x-csrf-token");
  console.log("[verifyCSRFToken] csrfCookie");
  console.log("[verifyCSRFToken] csrfHeader");

  if (!csrfCookie || !csrfHeader) {
    console.log("[verifyCSRFToken] CSRF token missing");
    throw new Error("CSRF token missing");
  }

  // hash cookie value แล้วเปรียบเทียบกับ header
  const hashedCookie = crypto.createHash("sha256").update(csrfCookie).digest("hex");
  console.log("[verifyCSRFToken] hashedCookie:");
  if (hashedCookie !== csrfHeader) {
    console.log("[verifyCSRFToken] Invalid CSRF token");
    throw new Error("Invalid CSRF token");
  }
  console.log("[verifyCSRFToken] CSRF token verified successfully");
  return true;
}
