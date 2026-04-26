import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { generateNonce } from "@/utils/nonce";

/**
 * Decode JWT payload without signature verification (Edge-runtime compatible).
 * Used only for routing decisions — actual data access always requires full
 * server-side JWT verification via jwtMiddleware in API routes.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const requestStartTime = Date.now(); // ⏱️ Track request start time
  const method = request.method;
  const url = request.nextUrl.pathname;

  console.log(`[⏱️  START] ${method} ${url}`);

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
  
  // Style source - In dev mode, Next.js injects many inline styles, so we need unsafe-inline
  // In production, we should use nonce-based approach
  const styleSrc = ["'self'"];
  if (isDev) {
    styleSrc.push("'unsafe-inline'"); // Dev: allow all inline styles for HMR and debugging
  } else {
    styleSrc.push(`'nonce-${nonce}'`); // Prod: require nonce for inline styles
  }
  
  // Style-src-elem for external stylesheets (Font Awesome CDN, Google Fonts)
  const styleSrcElem = ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"];
  if (isDev) {
    styleSrcElem.push("'unsafe-inline'"); // Dev: allow inline <style> tags
  }
  
  const csp = [
    "default-src 'none'",
    `script-src ${scriptSrc.join(" ")}`,
    `style-src ${styleSrc.join(" ")}`,
    `style-src-elem ${styleSrcElem.join(" ")}`,
    "img-src 'self' data: https://innomcp.dataxo.info http://localhost:3001 http://127.0.0.1:3001 blob: https://image.pollinations.ai https://imgen.mdes-innova.online",
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
    "connect-src 'self' https://innomcp.dataxo.info wss://innomcp.dataxo.info http://localhost:3000 ws://localhost:3000 http://127.0.0.1:3000 ws://127.0.0.1:3000 http://localhost:3011 ws://localhost:3011 http://127.0.0.1:3011 ws://127.0.0.1:3011 http://localhost:3012 ws://localhost:3012 http://127.0.0.1:3012 ws://127.0.0.1:3012 blob:",
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

  // ── RBAC Guard: /admin/* requires admin role (userrole_id === 0) ──────────
  if (request.nextUrl.pathname.startsWith("/admin")) {
    const tokenName = process.env.TOKEN_NAME || "token";
    const token = request.cookies.get(tokenName)?.value;
    const payload = token ? decodeJwtPayload(token) : null;
    // Redirect to root if no token or not admin (userrole_id !== 0)
    if (!payload || payload.userrole_id !== 0) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Strictly apply CORS only for API routes (CSRF protection removed)
  if (request.nextUrl.pathname.startsWith("/api/")) {
    // Allow CORS for production and local development
    const allowedOrigins = [
      "https://innomcp.dataxo.info",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
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
      "Content-Type,authorization,blob"
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
  response.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
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

  // ⏱️ Log response time
  const duration = Date.now() - requestStartTime;
  console.log(`[⏱️  ${duration}ms] ${method} ${url}`);

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
