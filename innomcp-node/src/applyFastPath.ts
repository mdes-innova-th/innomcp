// innomcp-node/src/applyFastPath.ts
// ✅ ไฟล์เดียวที่ "เสียบ" fastpath ให้ทำงานจริงก่อนเข้า AI/tool selection
// ใช้ได้ทั้ง Express + WebSocket (เลือกใช้ส่วนที่คุณมี)

import type { Express } from "express";
import type { Server as HttpServer } from "http";
import type WebSocket from "ws";
import { fastPathChatMiddleware } from "./middleware/fastpathChatMiddleware";
import { tryFastPathWebSocket } from "./services/fastPathHandler";

// ============================
// 1) Express: short-circuit ก่อน route chat
// ============================
export function applyFastPathToExpress(app: Express, chatRoutePath: string) {
  // IMPORTANT: วางก่อน router.post ใน chat.ts หรือ return middleware เพื่อใช้ใน router
  // ไม่ใช่ app.post ซ้ำ!
  // ใช้ app.use เพื่อแทรก middleware ก่อน handler
  app.use(chatRoutePath, fastPathChatMiddleware());
}

// ============================
// 2) WebSocket: short-circuit ก่อนส่งไป pipeline AI
// ============================
export function applyFastPathToWebSocket(
  wss: WebSocket.Server,
  opts: {
    // ใช้เพื่ออ่าน message user จาก payload ของคุณ
    extractUserText: (raw: any) => string | null;
    // ใช้เพื่อส่งกลับ client ในรูปแบบของระบบคุณ
    sendToClient: (ws: WebSocket, payload: any) => void;
    // ถ้า fastpath ไม่เข้า ให้ส่งต่อให้ handler หลักเดิมของคุณ
    nextHandler: (ws: WebSocket, raw: any) => Promise<void> | void;
  }
) {
  wss.on("connection", (ws: WebSocket) => {
    ws.on("message", async (buf: WebSocket.RawData) => {
      let raw: any = null;
      try {
        raw = JSON.parse(buf.toString());
      } catch {
        // ถ้าไม่ใช่ JSON ส่งต่อเลย
        return opts.nextHandler(ws, buf.toString());
      }

      const userText = opts.extractUserText(raw);
      if (!userText) return opts.nextHandler(ws, raw);

      // ✅ ลอง fastpath ก่อน (ตอบกลับทันที)
      const decision = await tryFastPathWebSocket(
        userText,
        (payload) => opts.sendToClient(ws, payload),
        {
          mode: (process.env.FASTPATH_MODE as any) || "on",
          extraPhrasesFile: process.env.FASTPATH_EXTRA_FILE,
          extraPhrasesUrl: process.env.FASTPATH_EXTRA_URL,
        }
      );

      if (decision.handled) return;
      return opts.nextHandler(ws, raw);
    });
  });
}
