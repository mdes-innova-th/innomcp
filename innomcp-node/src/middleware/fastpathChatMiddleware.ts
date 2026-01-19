// innomcp-node/src/middleware/fastpathChatMiddleware.ts
import { Request, Response, NextFunction } from "express";
import { createFastPathExpressMiddleware } from "../services/fastPathHandler";

/**
 * FastPath Chat Middleware
 * Use this on your chat route: app.post("/api/chat", fastPathChatMiddleware(), chatHandler)
 * It will intercept common greetings and respond immediately without hitting AI/tool selection
 */
export function fastPathChatMiddleware() {
  return createFastPathExpressMiddleware({
    mode: (process.env.FASTPATH_MODE as any) || "on",
    // optional overlays
    extraPhrasesFile: process.env.FASTPATH_EXTRA_FILE,
    extraPhrasesUrl: process.env.FASTPATH_EXTRA_URL,
  }) as unknown as (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
