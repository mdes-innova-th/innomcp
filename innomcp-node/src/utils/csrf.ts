import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export default function csrfMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Allow safe methods without CSRF check
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }

  const csrfHeader = (req.headers["x-csrf-token"] as string) || "";

  // Try to get csrf_token from cookie header (don't rely on cookie-parser)
  const cookieHeader = req.headers["cookie"] as string | undefined;
  let csrfCookie: string | undefined;
  if (cookieHeader) {
    const parts = cookieHeader.split(";").map((p) => p.trim());
    for (const p of parts) {
      if (p.startsWith("csrf_token=")) {
        csrfCookie = decodeURIComponent(p.substring("csrf_token=".length));
        break;
      }
    }
  }

  if (!csrfCookie || !csrfHeader) {
    console.error(
      "[csrfMiddleware] Invalid CSRF token - missing cookie or header"
    );
    res.status(403).json({ error: "Invalid CSRF token" });
    return;
  }

  const hashed = crypto.createHash("sha256").update(csrfCookie).digest("hex");
  if (hashed !== csrfHeader) {
    console.error("[csrfMiddleware] Invalid CSRF token");
    res.status(403).json({ error: "Invalid CSRF token" });
    return;
  }

  console.log("[csrfMiddleware] CSRF token validated successfully");

  next();
}
