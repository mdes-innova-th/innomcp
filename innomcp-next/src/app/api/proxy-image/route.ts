import { NextResponse, NextRequest } from "next/server";
import {
  extractClientIp,
  getApiKey,
  forwardQueryParams,
} from "@/app/lib/apiProxyUtils";
import { jwtMiddleware } from "@/jwtmiddleware";

/**
 * SSRF protection: block private IPs and unknown hosts.
 * (Shared logic with /api/proxy — duplicated here for route-level isolation.)
 */
function isImageUrlAllowed(endpoint: string): { allowed: boolean; reason?: string } {
  let targetUrl: URL;
  try {
    targetUrl = new URL(endpoint);
  } catch {
    return { allowed: false, reason: "Invalid URL" };
  }

  const hostname = targetUrl.hostname.toLowerCase();

  // Block private/reserved IP ranges to prevent SSRF
  const privateIpPatterns = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\./,
    /^::1$/,
    /^fc/,
    /^fe80/,
  ];

  for (const pattern of privateIpPatterns) {
    if (pattern.test(hostname)) {
      return { allowed: false, reason: `Private IP blocked: ${hostname}` };
    }
  }

  return { allowed: true };
}

/**
 * Handle GET requests for proxying image requests
 */
export async function GET(request: NextRequest) {
  console.log("[proxy-image] Handling GET request for proxying image");

  const { searchParams } = new URL(request.url);
  const apiImageHost = `http://${process.env.HOST}:${
    process.env.PORT || 3001
  }/api/images?path=`;

  // Extract client IP
  const ip = extractClientIp(request);
  request.headers.set?.("x-client-ip", ip);

  const endpoint = `${apiImageHost}/${searchParams.get("endpoint") || ""}`;
  console.log(`[proxy-image] Target endpoint: ${endpoint}`);

  // SSRF protection: validate constructed endpoint
  const urlCheck = isImageUrlAllowed(endpoint);
  if (!urlCheck.allowed) {
    console.warn(`[proxy-image] SSRF blocked: ${urlCheck.reason} (endpoint: ${endpoint})`);
    return NextResponse.json(
      { error: `Proxy request blocked: ${urlCheck.reason}` },
      { status: 403 }
    );
  }

  // ตรวจสอบ JWT จาก HttpOnly cookie เพิ่อดึง user_id
  const tokenName = process.env.TOKEN_NAME || "token";
  const jwtCookie = request.cookies.get(tokenName)?.value;
  console.log(`[proxy-image] JWT cookie present: ${jwtCookie ? "yes" : "no"}`);
  const jwtResult = jwtMiddleware(request);
  let user_id: string | undefined;

  if ("decoded" in jwtResult && jwtResult.decoded) {
    user_id = jwtResult.decoded.user_id as string;
  }
  const apiKey = await getApiKey(user_id ?? "", jwtCookie ?? "");
  if (!apiKey) {
    return NextResponse.json(
      { error: `[proxy-image] API key not configured` },
      { status: 404 }
    );
  }

  try {
    const targetUrl = new URL(endpoint);
    forwardQueryParams(searchParams, targetUrl.searchParams);

    // ดึง header จาก request เดิม
    const forwardHeaders: Record<string, string> = {};
    const incomingHeaders = request.headers;
    // Forward auth header, cookie, user-agent, accept, referer, origin, x-requested-with
    [
      "authorization",
      "cookie",
      "user-agent",
      "accept",
      "referer",
      "origin",
      "x-requested-with",
    ].forEach((key) => {
      const value = incomingHeaders.get(key);
      if (value) forwardHeaders[key] = value;
    });
    // เพิ่ม token scheme apiKey ถ้ายังไม่มี auth header
    if (!forwardHeaders["authorization"] && apiKey) {
      forwardHeaders["authorization"] = `bearer ${apiKey}`;
    }

    const response = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: forwardHeaders,
    });
    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Failed to fetch image",
          status: response.status,
          statusText: response.statusText,
        },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        {
          error: "Response is not an image",
          contentType: contentType,
          endpoint: endpoint,
        },
        { status: 400 }
      );
    }

    // Read the image data as an ArrayBuffer
    const imageBuffer = await response.arrayBuffer();
    const bufferLength = imageBuffer.byteLength;
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": bufferLength.toString(),
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error(
      "[proxy-image] catch-Error proxying image request to node service:",
      error
    );
    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      return NextResponse.json(
        {
          error: "Node service connection refused",
          details: `Cannot connect to service at ${endpoint}. Is the service running?`,
          resolution:
            "Make sure your Node service is running on the configured URL",
        },
        { status: 503 }
      );
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "[proxy-image] Failed to communicate with service",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
