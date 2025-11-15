import { Router, Request, Response } from "express";
import crypto from "crypto";

const csrfRouter = Router();

csrfRouter.get("/", (req: Request, res: Response) => {
  // Generate a random token
  const csrfToken = crypto.randomBytes(32).toString("hex");
  console.log(`[CSRF] Generated token`);

  // Hash the token to create a masked version
  const hashedToken = crypto.createHash("sha256").update(csrfToken).digest("hex");
  console.log(`[CSRF] Hashed token`);

  // Store the original token in a httpOnly cookie
  res.cookie("csrf_token", csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 3600 * 1000, // 1 hour in ms
  });
  console.log(`[CSRF] Set csrf_token cookie (httpOnly)`);

  // Store the hashed version in a separate cookie (optional, for middleware verification)
  res.cookie("csrf_token_hash", hashedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 3600 * 1000,
  });
  console.log(`[CSRF] Set csrf_token_hash cookie (httpOnly)`);

  // Return only the hashed version to the client
  res.json({ csrfToken: hashedToken });
  console.log(`[CSRF] Responded with hashed token`);
});

export default csrfRouter;
