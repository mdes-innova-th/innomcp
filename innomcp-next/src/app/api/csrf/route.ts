import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

// Generate a CSRF token
export async function GET() {
  try {
    // Generate a random token
    const csrfToken = crypto.randomBytes(32).toString("hex");

    // Hash the token to create a masked version
    const hashedToken = crypto
      .createHash("sha256")
      .update(csrfToken)
      .digest("hex");

    // Store the original token in a httpOnly cookie
    const cookieStore = cookies();
    (await cookieStore).set("csrf_token", csrfToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 3600, // 1 hour
    });

    // Also store the hashed version in a separate cookie for middleware verification
    (await cookieStore).set("csrf_token_hash", hashedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 3600, // 1 hour
    });

    // Return only the hashed version to the client
    return NextResponse.json({ csrfToken: hashedToken });
  } catch (error) {
    console.error("Error generating CSRF token:", error);
    return NextResponse.json(
      { error: "Failed to generate CSRF token" },
      { status: 500 }
    );
  }
}
