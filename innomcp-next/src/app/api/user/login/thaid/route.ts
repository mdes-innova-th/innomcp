import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import crypto from "crypto";
import { verifyCSRFToken } from "@/utils/verifyCSRFToken";

export async function POST(request: NextRequest) {
  try {
    // ตรวจสอบ CSRF token ก่อนดำเนินการ
    await verifyCSRFToken(request);

    // ตรวจสอบว่ามี environment variables ที่จำเป็น
    const clientId = process.env.THAID_CLIENT_ID;
    const isWebView = (await request.json())?.isWebView === true;

    // Try to detect the correct redirect URI from the request
    let redirectUri = `${
      process.env.NEXT_AUTH_URL || "http://localhost:3001"
    }/api/user/login/thaid/callback`;

    // If we're in a Docker environment, try to use the request's origin
    if (request.headers.get("host")) {
      const protocol =
        request.headers.get("x-forwarded-proto") ||
        (request.headers.get("host")?.includes("localhost") ? "http" : "https");
      const host = request.headers.get("host");
      const dynamicRedirectUri = `${protocol}://${host}/api/user/login/thaid/callback`;

      console.log("[ThaiD Login] - Redirect URI options:", {
        envBased: redirectUri,
        dynamicBased: dynamicRedirectUri,
        requestHost: host,
        requestProtocol: protocol,
        isWebView: isWebView,
      });

      // Use dynamic URI if it looks different from env-based
      if (dynamicRedirectUri !== redirectUri) {
        redirectUri = dynamicRedirectUri;
        console.log("[ThaiD Login] - Using dynamic redirect URI:", redirectUri);
      }
    }

    if (!clientId) {
      console.error(
        "[ThaiD Login] Missing THAID_CLIENT_ID environment variable"
      );
      return NextResponse.json(
        { error: "ThaiD configuration not found" },
        { status: 500 }
      );
    }

    // สร้าง state parameter สำหรับ CSRF protection
    let state = crypto.randomBytes(32).toString("hex");
    if (isWebView) {
      state = `${state}_webview`;
    }

    // เพิ่ม debugging logs
    console.log("[ThaiD Login] State generation", {
      stateLength: state.length,
      statePreview: state.substring(0, 10) + "...",
    });

    // สร้าง authorization URL
    const authUrl = new URL(
      process.env.THAID_AUTH_URL ||
        "https://imauth.bora.dopa.go.th/api/v2/oauth2/auth/"
    );
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("client_id", clientId);
    authUrl.searchParams.append("redirect_uri", redirectUri);
    authUrl.searchParams.append("scope", "given_name family_name birthdate");
    authUrl.searchParams.append("state", state);

    console.log("[ThaiD Login] Final Redirect URI:", redirectUri);
    console.log("[ThaiD Login] Final Auth URL:", authUrl.toString());

    // สร้าง response พร้อม state cookie
    console.log("[ThaiD Login] Setting state cookie with options");
    const response = NextResponse.json({
      authUrl: authUrl.toString(),
    });

    // เก็บ state ใน cookie เพื่อตรวจสอบในขั้นตอน callback
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 1800, // 30 minutes
      ...(isProduction && {
        domain: process.env.COOKIE_DOMAIN || ".dataxo.info",
      }),
    };

    response.cookies.set("cct_thaid_state", state, cookieOptions);
    console.log("[ThaiD Login] Cookie was set successfully");

    return response;
  } catch (error) {
    console.error("[ThaiD Login] Initiation error:", error);
    return NextResponse.json(
      { error: "Failed to initiate ThaiD login" },
      { status: 500 }
    );
  }
}
