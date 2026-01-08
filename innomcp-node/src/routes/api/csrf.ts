
import { Router, Request, Response } from "express";
import crypto from "crypto";
import { logBoth } from "../../utils/mcpLogger";

const csrfRouter = Router();

csrfRouter.get("/", (req: Request, res: Response) => {
  // Generate a random token
  const csrfToken = crypto.randomBytes(32).toString("hex");
  logBoth("info", `[CSRF] Generated token`);

  // Hash the token to create a masked version
  const hashedToken = crypto.createHash("sha256").update(csrfToken).digest("hex");
  logBoth("info", `[CSRF] Hashed token`);

  // Store the original token in a httpOnly cookie
  res.cookie("csrf_token", csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 3600 * 1000, // 1 hour in ms
  });
  logBoth("info", `[CSRF] Set csrf_token cookie (httpOnly)`);

  // Store the hashed version in a separate cookie (optional, for middleware verification)
  res.cookie("csrf_token_hash", hashedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 3600 * 1000,
  });
  logBoth("info", `[CSRF] Set csrf_token_hash cookie (httpOnly)`);

  // Return only the hashed version to the client
  res.json({ csrfToken: hashedToken });
  logBoth("info", `[CSRF] Responded with hashed token`);
});

export default csrfRouter;
