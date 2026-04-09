import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mcpLog } from "../../utils/mcpLogger";
import { logBoth } from "../../utils/mcpLogger";

// Webd Tools - Web Domain Statistics from WEBDDSB Backend
type WebdInput = {
  query: string;
};

export function registerWebdTools(mcpserver: McpServer) {
  mcpserver.registerTool(
    "webdTool_group",
    {
      title:
        "ดึงจำนวนเว็บไซต์ผิดกฎหมาย แยกตามกลุ่มความผิด ในคำขอต้องมีคำว่า 'webd' พร้อมกับ 'กลุ่ม', 'หมวด', 'ประเภท' หรือชื่อความผิด",
      description: `
หน้าที่: คืนสถิติจำนวนเว็บไซต์/URL แยกตามกลุ่มความผิด (category/group)
ใช้เมื่อ:
- ในคำขอของผู้ใช้ต้องมีคำว่า "webd" พร้อมกับ "กลุ่ม", "หมวด", "ประเภท" หรือ ชื่อความผิด ตัวอย่างเช่น "hate speech", "ลามก", "พนัน"
- ต้องการสถิติแยกตามกลุ่มความผิดโดย กรองตามวันที่ มีคำร้อง/ไม่มีคำร้อง หรือมีคำสั่งศาล/ไม่มีคำสั่งศาล
ไม่ใช้เมื่อ: 
- ในคำขอของผู้ใช้ไม่มีคำว่า "webd" พร้อมกับ "กลุ่ม", "หมวด", "ประเภท", หรือชื่อความผิด
- ต้องการข้อมูลที่แยกตามกลุ่มแพลตฟอร์ม หรือแพลตฟอร์มที่ระบุ หรือประเทศที่ลงทะเบียนโดเมน
พารามิเตอร์: { query: string } (optional) — คำค้นหรือชื่อกลุ่มเพื่อกรองผล
ตัวอย่าง request: POST /api/urlstats/violation-groups-count { "query": "hate" }
ตัวอย่าง response:
  { "success": true, "data": [{ "group_name": "hate speech", "url_count": 618 }] }
ข้อผิดพลาดที่คาดได้: 401 (missing/invalid API key), 400 (invalid payload), 500 (internal error)
หมายเหตุ: ผลลัพธ์เป็น aggregate counts; อ่าน field 'group_name' และ 'url_count' เพื่อใช้งานต่อ`,
    },
    async (args: any) => {
      const { query } = args as WebdInput;
      
      mcpLog('INFO', `[Webd Group Tool] Query: ${query || 'all'}`);
      
      const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
      const webddsbPort = process.env.WEBDDSB_PORT || "3011";
      const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
      try {
        const csrfRes = await fetch(
          `http://${webddsbHost}:${webddsbPort}/api-get/csrf`,
          {
            method: "GET",
            headers: { "x-api-key": webddsbApiKey },
          }
        );

        if (!csrfRes.ok) throw new Error(`csrf GET failed ${csrfRes.status}`);

        const csrfBody = await csrfRes.json();
        const csrfToken = csrfBody.csrfToken;
        if (!csrfToken) throw new Error("No csrfToken in response");

        let setCookieHeaders: string[] = [];
        const cookiehdr =
          csrfRes.headers.get && csrfRes.headers.get("set-cookie");
        if (cookiehdr) {
          setCookieHeaders = [cookiehdr];
        } else {
          const cookies = csrfRes.headers.get("set-cookie");
          if (cookies) {
            setCookieHeaders = Array.isArray(cookies) ? cookies : [cookies];
          }
        }

        let cookieHeader = "";
        if (setCookieHeaders.length) {
          cookieHeader = setCookieHeaders
            .map((s) => s.split(";")[0].trim())
            .join("; ");
        }

        const postRes = await fetch(
          `http://${webddsbHost}:${webddsbPort}/api/urlstats/violation-groups-count`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": webddsbApiKey,
              "x-csrf-token": csrfToken,
              ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
            body: JSON.stringify({ query }),
          }
        );

        if (!postRes.ok) {
          throw new Error(`API request failed with status ${postRes.status}`);
        }

        const data = await postRes.json();
        mcpLog('INFO', `[Webd Group Tool] Fetched ${data?.data?.length || 0} group records`);

        return {
          content: [
            { type: "text", text: JSON.stringify(data) } as {
              type: "text";
              text: string;
            },
          ],
          structuredContent: data,
        };
      } catch (error: any) {
        logBoth('ERROR', `[Webd Group Tool] Error fetching groups count: ${error && error.message ? error.message : error}`);
        // Check if backend service is unavailable
        if (error.cause?.code === 'ECONNREFUSED' || error.code === 'ECONNREFUSED') {
          const errorMsg = `❌ **Backend Service Unavailable**\n\n` +
            `Cannot connect to WEBDDSB backend at http://${webddsbHost}:${webddsbPort}\n\n` +
            `**Please ensure:**\n` +
            `1. innomcp-node server is running on port ${webddsbPort}\n` +
            `2. Run: \`cd innomcp-node && npm run dev\`\n` +
            `3. Check WEBDDSB_HOST and WEBDDSB_PORT in .env\n\n` +
            `**Error:** ${error.message || 'Connection refused'}`;
          return {
            content: [{ type: "text" as const, text: errorMsg }]
          };
        }
        // Other errors
        const errorMsg = `❌ **Error fetching Webd groups data**\n\n` +
          `${error.message || 'Unknown error'}\n\n` +
          `Please check your API key and backend configuration.`;
        
        return {
          content: [{ type: "text" as const, text: errorMsg }]
        };
      }
    }
  );

  mcpserver.registerTool(
    "webdTool_platforms",
    {
      title:
        "ดึงสถิติ URL แยกตามแพลตฟอร์ม ในคำขอต้องมีคำว่า 'webd' พร้อมกับ 'แพลตฟอร์ม' , 'platform' หรือชื่อเว็บไซต์ หรือชื่อแพลตฟอร์ม",
      description: `
หน้าที่: คืนสัดส่วนและจำนวน URL แยกตามแพลตฟอร์ม (เช่น Facebook, Instagram, TikTok)
ใช้เมื่อ:
- ในคำขอของผู้ใช้ต้องมีคำว่า "webd" พร้อมกับ "แพลตฟอร์ม", "platform" หรือชื่อเว็บไซต์ หรือชื่อแพลตฟอร์ม ตัวอย่างเช่น "Facebook", "YouTube", "TikTok"
- ต้องการทราบการกระจายตัวของรายการตามแพลตฟอร์มเพื่อวิเคราะห์ช่องทางที่พบปัญหามากที่สุด
ไม่ใช้เมื่อ:
- ในคำขอของผู้ใช้ ไม่มีคำว่า "webd" พร้อมกับ "แพลตฟอร์ม", "platform" หรือชื่อเว็บไซต์ หรือชื่อแพลตฟอร์ม
- การขอข้อมูลที่เป็นรายวัน/รายเดือน หรือต้องการกรองตามคำสั่งศาล
- ต้องการแยกตามกลุ่มความผิด หรือประเทศที่จดทะเบียนโดเมน
พารามิเตอร์: { requestType?: string } (optional) — คำอธิบายชนิดข้อมูลแพลตฟอร์มที่ต้องการ (summary/detail)
ตัวอย่าง request: GET /api/urlstats/platforms
ตัวอย่าง response:
  { "success": true, "data": [{ "platform": "facebook", "url_count": 500, "percentage": 45.3 }] }
ข้อผิดพลาดที่คาดได้: 401 (API key), 500 (internal error)
หมายเหตุ: ฟิลด์ 'percentage' จะถูกคำนวณจาก 'url_count' หาก API ต้นทางไม่ส่งค่าเปอร์เซ็นต์มา`,
    },
    async (args: any) => {
      const input = args as { requestType?: string };
      const requestType = input.requestType;
      
      mcpLog('INFO', `[Webd Platforms Tool] Request type: ${requestType || 'default'}`);
      
      const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
      const webddsbPort = process.env.WEBDDSB_PORT || "3011";
      const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
      try {
        // Obtain CSRF token and cookies first (same flow as count_group)
        const csrfRes = await fetch(
          `http://${webddsbHost}:${webddsbPort}/api-get/csrf`,
          {
            method: "GET",
            headers: { "x-api-key": webddsbApiKey },
          }
        );

        if (!csrfRes.ok) throw new Error(`csrf GET failed ${csrfRes.status}`);

        const csrfBody = await csrfRes.json();
        const csrfToken = csrfBody.csrfToken;
        if (!csrfToken) throw new Error("No csrfToken in response");
        
        mcpLog('INFO', '[Webd Platforms Tool] CSRF token obtained');

        // Extract set-cookie(s)
        let setCookieHeaders: string[] = [];
        const cookiehdr =
          csrfRes.headers.get && csrfRes.headers.get("set-cookie");
        if (cookiehdr) {
          setCookieHeaders = [cookiehdr];
        } else {
          const cookies =
            (csrfRes.headers as any).get && csrfRes.headers.get("set-cookie");
          if (cookies) {
            setCookieHeaders = Array.isArray(cookies) ? cookies : [cookies];
          }
        }

        let cookieHeader = "";
        if (setCookieHeaders.length) {
          cookieHeader = setCookieHeaders
            .map((s) => s.split(";")[0].trim())
            .join("; ");
        }

        // Call the actual platforms endpoint with CSRF token and cookies
        const res = await fetch(
          `http://${webddsbHost}:${webddsbPort}/api/urlstats/platforms`,
          {
            method: "GET",
            headers: {
              "x-api-key": webddsbApiKey,
              "x-csrf-token": csrfToken,
              ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
          }
        );

        if (!res.ok) {
          throw new Error(`API request failed with status ${res.status}`);
        }

        let data = await res.json();
        
        mcpLog('INFO', `[Webd Platforms Tool] Fetched ${data?.data?.length || 0} platform records`);

        // Normalize data to ensure `percentage` field exists and is a number
        try {
          const items = Array.isArray(data?.data) ? data.data : null;
          if (items) {
            // Compute total url_count if any item has missing percentage
            const needsCompute = items.some(
              (it: any) => typeof it.percentage !== "number"
            );
            if (needsCompute) {
              const total =
                items.reduce(
                  (s: number, it: any) => s + (Number(it.url_count) || 0),
                  0
                ) || 0;
              if (total > 0) {
                data.data = items.map((it: any) => ({
                  ...it,
                  url_count: Number(it.url_count) || 0,
                  percentage: Number.isFinite(Number(it.percentage))
                    ? Number(it.percentage)
                    : Math.round(
                        ((Number(it.url_count) || 0) / total) * 10000
                      ) / 100,
                }));
              } else {
                // No counts available, set percentage to 0 for each
                data.data = items.map((it: any) => ({
                  ...it,
                  url_count: Number(it.url_count) || 0,
                  percentage:
                    typeof it.percentage === "number" ? it.percentage : 0,
                }));
              }
            }
          }
        } catch (err) {
          console.warn("[MCP Server] Failed to normalize platforms data:", err);
        }

        return {
          content: [
            { type: "text", text: JSON.stringify(data) } as {
              type: "text";
              text: string;
            },
          ],
          structuredContent: data,
        };
      } catch (error: any) {
        console.error("Error fetching platform list:", error);
        
        // Check if backend service is unavailable
        if (error.cause?.code === 'ECONNREFUSED' || error.code === 'ECONNREFUSED') {
          const errorMsg = `❌ **Backend Service Unavailable**\n\n` +
            `Cannot connect to WEBDDSB backend at http://${webddsbHost}:${webddsbPort}\n\n` +
            `**Please ensure:**\n` +
            `1. innomcp-node server is running on port ${webddsbPort}\n` +
            `2. Run: \`cd innomcp-node && npm run dev\`\n` +
            `3. Check WEBDDSB_HOST and WEBDDSB_PORT in .env\n\n` +
            `**Error:** ${error.message || 'Connection refused'}`;
          
          return {
            content: [{ type: "text" as const, text: errorMsg }]
          };
        }
        
        // Other errors
        const errorMsg = `❌ **Error fetching Webd platforms data**\n\n` +
          `${error.message || 'Unknown error'}\n\n` +
          `Please check your API key and backend configuration.`;
        
        return {
          content: [{ type: "text" as const, text: errorMsg }]
        };
      }
    }
  );

  // webdTool_register_country
  mcpserver.registerTool(
    "webdTool_register_country",
    {
      title: "ดึงสถิติ URL แยกตามประเทศที่จดทะเบียน ในคำขอต้องมีคำว่า 'webd' พร้อมกับ 'ประเทศ', 'country', 'ที่ตั้ง' หรือชื่อประเทศ",
      description: `
หน้าที่: คืนสถิติจำนวนและสัดส่วนของ URL แยกตามประเทศที่ลงทะเบียนโดเมน
ใช้เมื่อ:
- ในคำขอของผู้ใช้ต้องมีคำว่า "webd" พร้อมกับ "ประเทศ", "country", "ที่ตั้ง", หรือชื่อประเทศ ยกตัวอย่างเช่น "Thailand", "สิงคโปร์", "มาเลเซีย" 
- ต้องการวิเคราะห์การกระจายตามประเทศเพื่อตรวจสอบแหล่งที่มาของโดเมน/URL
ไม่ใช้เมื่อ: 
- ในคำขอของผู้ใช้ไม่มีคำว่า "webd" พร้อมกับ "ประเทศ" หรือ "country" หรือ "ที่ตั้ง" หรือชื่อประเทศ
- ต้องการข้อมูลที่เป็นรายวัน/รายเดือน หรือการกรองตามแพลตฟอร์ม/คำสั่งศาล
พารามิเตอร์: ไม่มี (GET)
ตัวอย่าง request: GET /api/urlstats/register-country
ตัวอย่าง response:
  { "success": true, "data": [{ "country": "TH", "url_count": 300, "percentage": 30.0 }] }
ข้อผิดพลาดที่คาดได้: 401 (API key), 500 (server error)
หมายเหตุ: หาก API ต้นทางไม่ส่ง 'percentage' ฟังก์ชันจะคำนวณให้โดยอัตโนมัติ`,
    },
    async () => {
      mcpLog('INFO', '[Webd Register Country Tool] Request received');
      
      const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
      const webddsbPort = process.env.WEBDDSB_PORT || "3011";
      const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
      try {
        // Obtain CSRF token and cookies first
        const csrfRes = await fetch(
          `http://${webddsbHost}:${webddsbPort}/api-get/csrf`,
          {
            method: "GET",
            headers: { "x-api-key": webddsbApiKey },
          }
        );

        if (!csrfRes.ok) throw new Error(`csrf GET failed ${csrfRes.status}`);

        const csrfBody = await csrfRes.json();
        const csrfToken = csrfBody.csrfToken;
        if (!csrfToken) throw new Error("No csrfToken in response");
        
        mcpLog('INFO', '[Webd Register Country Tool] CSRF token obtained');

        // Extract set-cookie(s)
        let setCookieHeaders: string[] = [];
        const cookiehdr =
          csrfRes.headers.get && csrfRes.headers.get("set-cookie");
        if (cookiehdr) {
          setCookieHeaders = [cookiehdr];
        } else {
          const cookies =
            (csrfRes.headers as any).get && csrfRes.headers.get("set-cookie");
          if (cookies) {
            setCookieHeaders = Array.isArray(cookies) ? cookies : [cookies];
          }
        }

        let cookieHeader = "";
        if (setCookieHeaders.length) {
          cookieHeader = setCookieHeaders
            .map((s) => s.split(";")[0].trim())
            .join("; ");
        }

        const res = await fetch(
          `http://${webddsbHost}:${webddsbPort}/api/urlstats/register-country`,
          {
            method: "GET",
            headers: {
              "x-api-key": webddsbApiKey,
              "x-csrf-token": csrfToken,
              ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
          }
        );

        if (!res.ok) {
          throw new Error(`API request failed with status ${res.status}`);
        }

        let data = await res.json();
        
        mcpLog('INFO', `[Webd Register Country Tool] Fetched ${data?.data?.length || 0} country records`);

        // Normalize to ensure percentage exists
        try {
          const items = Array.isArray(data?.data) ? data.data : null;
          if (items) {
            const needsCompute = items.some(
              (it: any) => typeof it.percentage !== "number"
            );
            if (needsCompute) {
              const total =
                items.reduce(
                  (s: number, it: any) => s + (Number(it.url_count) || 0),
                  0
                ) || 0;
              if (total > 0) {
                data.data = items.map((it: any) => ({
                  ...it,
                  url_count: Number(it.url_count) || 0,
                  percentage: Number.isFinite(Number(it.percentage))
                    ? Number(it.percentage)
                    : Math.round(
                        ((Number(it.url_count) || 0) / total) * 10000
                      ) / 100,
                }));
              } else {
                data.data = items.map((it: any) => ({
                  ...it,
                  url_count: Number(it.url_count) || 0,
                  percentage:
                    typeof it.percentage === "number" ? it.percentage : 0,
                }));
              }
            }
          }
        } catch (err) {
          console.warn(
            "[MCP Server] Failed to normalize register country data:",
            err
          );
        }

        return {
          content: [
            { type: "text", text: JSON.stringify(data) } as {
              type: "text";
              text: string;
            },
          ],
          structuredContent: data,
        };
      } catch (error: any) {
        console.error("Error fetching register country:", error);
        
        // Check if backend service is unavailable
        if (error.cause?.code === 'ECONNREFUSED' || error.code === 'ECONNREFUSED') {
          const errorMsg = `❌ **Backend Service Unavailable**\n\n` +
            `Cannot connect to WEBDDSB backend at http://${webddsbHost}:${webddsbPort}\n\n` +
            `**Please ensure:**\n` +
            `1. innomcp-node server is running on port ${webddsbPort}\n` +
            `2. Run: \`cd innomcp-node && npm run dev\`\n` +
            `3. Check WEBDDSB_HOST and WEBDDSB_PORT in .env\n\n` +
            `**Error:** ${error.message || 'Connection refused'}`;
          
          return {
            content: [{ type: "text" as const, text: errorMsg }]
          };
        }
        
        // Other errors
        const errorMsg = `❌ **Error fetching Webd country data**\n\n` +
          `${error.message || 'Unknown error'}\n\n` +
          `Please check your API key and backend configuration.`;
        
        return {
          content: [{ type: "text" as const, text: errorMsg }]
        };
      }
    }
  );

  // ---- Web-D API (webd-api:3014) tools — court-order / URL domain ----

  const WEBD_API_BASE = `http://${process.env.WEBD_API_HOST || "localhost"}:${process.env.WEBD_API_PORT || "3014"}`;

  async function callWebdAPI<T = any>(path: string): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    try {
      const res = await fetch(`${WEBD_API_BASE}${path}`, { signal: ctrl.signal });
      const body = await res.json() as any;
      if (!res.ok) throw new Error(body?.message || `HTTP ${res.status}`);
      return body as T;
    } finally {
      clearTimeout(timer);
    }
  }

  mcpserver.registerTool(
    "webdTool_court_order_url_count",
    {
      title: "นับจำนวน URL ในคำสั่งศาล (court order) ระบุ — ใช้เมื่อมีคำว่า 'webd' + 'คำสั่งศาล' หรือ 'court order'",
      description: `หน้าที่: คืนจำนวน URL ที่อยู่ภายใต้คำสั่งศาลระบุ (by orderId or orderNo)
ใช้เมื่อ: ผู้ใช้ถามเกี่ยวกับจำนวน URL ในคำสั่งศาล
พารามิเตอร์: { orderId?: number, orderNo?: string }`,
    },
    async (args: any) => {
      const { orderId, orderNo } = args as { orderId?: number; orderNo?: string };
      mcpLog("INFO", `[webdTool_court_order_url_count] orderId=${orderId} orderNo=${orderNo}`);
      try {
        let data: any;
        if (orderNo) {
          data = await callWebdAPI(`/court-orders/by-order-no/${encodeURIComponent(orderNo)}/url-count`);
        } else if (orderId) {
          data = await callWebdAPI(`/court-orders/${orderId}/url-count`);
        } else {
          return { content: [{ type: "text" as const, text: "❌ ต้องระบุ orderId หรือ orderNo" }] };
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(data) }], structuredContent: data };
      } catch (e: any) {
        logBoth("ERROR", `[webdTool_court_order_url_count] ${e.message}`);
        return { content: [{ type: "text" as const, text: `❌ ${e.message}` }] };
      }
    }
  );

  mcpserver.registerTool(
    "webdTool_top_court_orders",
    {
      title: "คำสั่งศาลที่มี URL มากที่สุด — ใช้เมื่อมี 'webd' + 'คำสั่งศาล' + 'มากที่สุด/อันดับ/top'",
      description: `หน้าที่: คืนรายการคำสั่งศาล เรียงตามจำนวน URL มากไปน้อย
ใช้เมื่อ: ผู้ใช้ต้องการทราบคำสั่งศาลที่มี URL มากที่สุด
พารามิเตอร์: { limit?: number } — จำนวนรายการ (default 10, max 20)`,
    },
    async (args: any) => {
      const { limit } = args as { limit?: number };
      mcpLog("INFO", `[webdTool_top_court_orders] limit=${limit || 10}`);
      try {
        const data = await callWebdAPI(`/court-orders/top-by-url-count?limit=${limit || 10}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(data) }], structuredContent: data };
      } catch (e: any) {
        logBoth("ERROR", `[webdTool_top_court_orders] ${e.message}`);
        return { content: [{ type: "text" as const, text: `❌ ${e.message}` }] };
      }
    }
  );

  mcpserver.registerTool(
    "webdTool_url_has_court_order",
    {
      title: "ตรวจสอบว่า URL มีคำสั่งศาลหรือไม่ — ใช้เมื่อมี 'webd' + URL + 'คำสั่งศาล'",
      description: `หน้าที่: ตรวจว่า URL ที่ระบุมีคำสั่งศาลครอบคลุมหรือไม่
ใช้เมื่อ: ผู้ใช้ต้องการตรวจสอบว่า URL เฉพาะถูกบล็อกหรือมีคำสั่งศาลแล้วหรือยัง
พารามิเตอร์: { url: string }`,
    },
    async (args: any) => {
      const { url } = args as { url: string };
      if (!url) return { content: [{ type: "text" as const, text: "❌ ต้องระบุ URL" }] };
      mcpLog("INFO", `[webdTool_url_has_court_order] url=${url}`);
      try {
        const data = await callWebdAPI(`/urls/has-court-order?url=${encodeURIComponent(url)}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(data) }], structuredContent: data };
      } catch (e: any) {
        logBoth("ERROR", `[webdTool_url_has_court_order] ${e.message}`);
        return { content: [{ type: "text" as const, text: `❌ ${e.message}` }] };
      }
    }
  );
}
