import { NextResponse, NextRequest } from "next/server";
import {
  extractClientIp,
  getApiKey,
  forwardQueryParams,
} from "@/app/lib/apiProxyUtils";
import { jwtMiddleware } from "@/jwtmiddleware";

/**
 * SSRF protection: validate that the target URL is allowed.
 * Blocks private IPs (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x)
 * and only permits known backend hosts.
 */
function isUrlAllowed(endpoint: string): { allowed: boolean; reason?: string } {
  let targetUrl: URL;
  try {
    targetUrl = new URL(endpoint);
  } catch {
    return { allowed: false, reason: "Invalid URL" };
  }

  // Only allow HTTPS in production
  if (process.env.NODE_ENV === "production" && targetUrl.protocol !== "https:") {
    return { allowed: false, reason: "Only HTTPS allowed in production" };
  }

  const hostname = targetUrl.hostname.toLowerCase();

  // Block private/reserved IP ranges to prevent SSRF
  const privateIpPatterns = [
    /^127\./,                        // loopback
    /^10\./,                          // 10.0.0.0/8
    /^172\.(1[6-9]|2\d|3[01])\./,    // 172.16.0.0/12
    /^192\.168\./,                    // 192.168.0.0/16
    /^169\.254\./,                    // link-local (cloud metadata)
    /^0\./,                           // 0.0.0.0/8
    /^::1$/,                          // IPv6 loopback
    /^fc/,                            // IPv6 unique local
    /^fe80/,                          // IPv6 link-local
  ];

  for (const pattern of privateIpPatterns) {
    if (pattern.test(hostname)) {
      return { allowed: false, reason: `Private IP blocked: ${hostname}` };
    }
  }

  // Allow known backend hosts
  const backendHost = process.env.NODE_BACKEND_HOST || "localhost";
  const allowedHosts = [backendHost, "localhost", "innomcp.dataxo.info"];
  // In development, allow any localhost port
  if (process.env.NODE_ENV === "development" && (hostname === "localhost" || hostname === "127.0.0.1")) {
    return { allowed: true };
  }

  if (!allowedHosts.some(h => hostname === h || hostname.endsWith(`.${h}`))) {
    return { allowed: false, reason: `Host not in allowlist: ${hostname}` };
  }

  return { allowed: true };
}

export async function GET(request: NextRequest) {
  console.log("[proxy] Handling GET request for proxy");
  const { searchParams } = new URL(request.url);

  // Extract client IP
  const ip = extractClientIp(request);
  request.headers.set?.("x-client-ip", ip);

  const endpoint = `${searchParams.get("endpoint") || ""}`;
  console.log(`[proxy] GET to endpoint: ${endpoint}`);

  // SSRF protection: validate endpoint before proxying
  const urlCheck = isUrlAllowed(endpoint);
  if (!urlCheck.allowed) {
    console.warn(`[proxy] SSRF blocked: ${urlCheck.reason} (endpoint: ${endpoint})`);
    return NextResponse.json(
      { error: `Proxy request blocked: ${urlCheck.reason}` },
      { status: 403 }
    );
  }

  // ตรวจสอบ JWT จาก HttpOnly cookie เพิ่อดึง user_id
  const tokenName = process.env.TOKEN_NAME || "token";
  const jwtCookie = request.cookies.get(tokenName)?.value;
  console.log(`[proxy] JWT cookie present: ${jwtCookie ? "yes" : "no"}`);
  const jwtResult = jwtMiddleware(request);
  let user_id: string | undefined;

  if ("decoded" in jwtResult && jwtResult.decoded) {
    user_id = jwtResult.decoded.user_id as string;
  }
  const apiKey = await getApiKey(user_id ?? "", jwtCookie ?? "");
  if (!apiKey) {
    return NextResponse.json(
      { error: `[proxy] API key not configured` },
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
      "x-csrf-token",
    ].forEach((key) => {
      const value = incomingHeaders.get(key);
      if (value) forwardHeaders[key] = value;
    });
    // เพิ่ม token scheme apiKey ถ้ายังไม่มี auth header
    if (!forwardHeaders["authorization"] && apiKey) {
      forwardHeaders["authorization"] = `bearer ${apiKey}`;
    }
    // เพิ่ม Content-Type สำหรับ JSON
    forwardHeaders["content-type"] = "application/json";

    const response = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: forwardHeaders,
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Failed to fetch data",
          status: response.status,
          statusText: response.statusText,
        },
        { status: response.status }
      );
    }

    let data;
    let isJson = false;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await response.json();
      isJson = true;
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
        isJson = true;
      } catch {
        data = text;
        isJson = false;
      }
    }

    if (!isJson) {
      return NextResponse.json(
        {
          error: "Response is not valid JSON",
          contentType: contentType,
          endpoint: endpoint,
          raw: data,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: response.ok,
        data: data,
        status: response.status,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=300",
          // Removed Access-Control-Allow-Origin: * — CORS handled by Next.js middleware
          "Access-Control-Allow-Methods": "GET",
          "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token",
        },
      }
    );
  } catch (error) {
    console.error(
      "[proxy] catch-Error proxying request to node service:",
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
        error: "[proxy] Failed to communicate with service",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * Handle POST requests similarly
 */
export async function POST(request: NextRequest) {
  console.log("[proxy] Handling POST request for proxy");
  const { searchParams } = new URL(request.url);

  // Extract client IP
  const ip = extractClientIp(request);
  request.headers.set?.("x-client-ip", ip);

  const endpoint = searchParams.get("endpoint") || "";
  console.log(`[proxy] POST to endpoint: ${endpoint}`);

  // SSRF protection: validate endpoint before proxying
  const urlCheck = isUrlAllowed(endpoint);
  if (!urlCheck.allowed) {
    console.warn(`[proxy] SSRF blocked: ${urlCheck.reason} (endpoint: ${endpoint})`);
    return NextResponse.json(
      { error: `Proxy request blocked: ${urlCheck.reason}` },
      { status: 403 }
    );
  }

  // ตรวจสอบ JWT จาก HttpOnly cookie เพิ่อดึง user_id
  const tokenName = process.env.TOKEN_NAME || "token";
  const jwtCookie = request.cookies.get(tokenName)?.value;
  console.log(`[proxy] JWT cookie present: ${jwtCookie ? "yes" : "no"}`);
  const jwtResult = jwtMiddleware(request);
  let user_id: string | undefined;

  if ("decoded" in jwtResult && jwtResult.decoded) {
    user_id = jwtResult.decoded.user_id as string;
  }
  const apiKey = await getApiKey(user_id ?? "", jwtCookie ?? "");
  if (!apiKey) {
    return NextResponse.json(
      { error: `[proxy] API key not configured` },
      { status: 404 }
    );
  }

  try {
    const body = await request.json();
    const targetUrl = new URL(endpoint);
    console.log(`Making POST request to: ${targetUrl.toString()}`);
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
      "x-csrf-token",
    ].forEach((key) => {
      const value = incomingHeaders.get(key);
      if (value) forwardHeaders[key] = value;
    });
    // เพิ่ม token scheme apiKey ถ้ายังไม่มี auth header
    if (!forwardHeaders["authorization"] && apiKey) {
      forwardHeaders["authorization"] = `bearer ${apiKey}`;
    }
    // เพิ่ม Content-Type สำหรับ JSON
    forwardHeaders["content-type"] = "application/json";

    const response = await fetch(targetUrl.toString(), {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Failed to post data",
          status: response.status,
          statusText: response.statusText,
        },
        { status: response.status }
      );
    }

    let data;
    let isJson = false;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await response.json();
      isJson = true;
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
        isJson = true;
      } catch {
        data = text;
        isJson = false;
      }
    }

    if (!isJson) {
      return NextResponse.json(
        {
          error: "Response is not valid JSON",
          contentType: contentType,
          endpoint: endpoint,
          raw: data,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: response.ok,
        data: data,
        status: response.status,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=300",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token",
        },
      }
    );
  } catch (error) {
    console.error(
      "[proxy] catch-Error proxying POST request to service:",
      error
    );
    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      return NextResponse.json(
        {
          error: "Service connection refused",
          details: `Cannot connect to service at ${endpoint}. Is the service running?`,
          resolution:
            "Make sure your service is running on the configured endpoint URL",
        },
        { status: 503 }
      );
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "[proxy] Failed to communicate with service",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
