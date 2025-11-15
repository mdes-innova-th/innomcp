import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { generateNonce } from "@/utils/nonce";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Get or generate nonce using cookies for better performance
  const cookieStore = cookies();
  let nonce = (await cookieStore).get("csp_nonce")?.value;
  let shouldSetCookie = false;

  // Generate new nonce if not found in cookies
  if (!nonce) {
    nonce = generateNonce();
    shouldSetCookie = true;
  }

  // Set nonce cookie only when needed to reduce overhead
  if (shouldSetCookie) {
    response.cookies.set("csp_nonce", nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });
  }

  // Ensure the nonce is passed to the frontend via a custom header
  response.headers.set("x-nonce", nonce);

  // Build Content Security Policy with nonce - Maximum Security Configuration
  const isDev = process.env.NODE_ENV === "development";
  console.log(
    `[middleware] NODE_ENV: ${process.env.NODE_ENV}, isDev: ${isDev}`
  );

  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  // Only add 'unsafe-eval' in development mode
  if (isDev) {
    scriptSrc.push("'unsafe-eval'");
  }
  const csp = [
    "default-src 'none'",
    `script-src ${scriptSrc.join(" ")}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: https://innomcp.dataxo.info http://localhost:3001 http://127.0.0.1:3001 blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://innomcp.dataxo.info wss://innomcp.dataxo.info http://localhost:3000 ws://localhost:3000 http://127.0.0.1:3000 ws://127.0.0.1:3000 http://localhost:3011 ws://localhost:3011 http://127.0.0.1:3011 ws://127.0.0.1:3011 http://innomcp-node:3010 ws://innomcp-node:3010 blob:",
    "object-src blob:",
    "media-src 'self' blob:",
    "child-src 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
    "block-all-mixed-content",
  ].join("; ");

  // Strictly apply CORS only for API routes (CSRF protection removed)
  if (request.nextUrl.pathname.startsWith("/api/")) {
    // Allow CORS for production and local development
    const allowedOrigins = [
      "https://innomcp.dataxo.info",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
    ];
    const origin = request.headers.get("origin");
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
    } else {
      response.headers.set(
        "Access-Control-Allow-Origin",
        "https://innomcp.dataxo.info"
      );
    }
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,DELETE,OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type,Authorization,blob"
    );
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Max-Age", "86400"); // 24 hours

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: response.headers,
      });
    }
  }

  // Set maximum security headers for all non-static routes
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  response.headers.set("X-XSS-Protection", "0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), accelerometer=(), gyroscope=(), magnetometer=(), ambient-light-sensor=()"
  );
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("X-Download-Options", "noopen");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set(
    "X-Robots-Tag",
    "noindex, nofollow, noarchive, nosnippet, noimageindex"
  );

  return response;
}

// CSP headers apply to all routes except static assets
export const config = {
  matcher: [
    // Apply CSP headers to all routes (except static assets)
    "/((?!_next/static|_next/image|favicon.ico).*)",
    // Still match API routes for CORS, but not for CSRF
    "/api/:path*",
  ],
};
