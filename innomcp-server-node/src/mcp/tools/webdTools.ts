import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerWebdTools(mcpserver: McpServer) {
  mcpserver.registerTool(
    "webdTool_group",
    {
      title: "ดึงจำนวนเว็บไซต์ผิดกฎหมาย",
      description: `
หน้าที่: คืนสถิติจำนวนเว็บไซต์/URL แยกตามกลุ่มความผิด (category/group)
ใช้เมื่อ:
- ในคำขอของผู้ใช้มีคำว่า "กลุ่ม" หรือ "หมวด" หรือ "ประเภท" หรือชื่อความผิด
- ต้องการสถิติแยกตามกลุ่มความผิดโดย กรองตามวันที่ มีคำร้อง/ไม่มีคำร้อง หรือมีคำสั่งศาล/ไม่มีคำสั่งศาล
ไม่ใช้เมื่อ: 
- ในคำขอของผู้ใช้ไม่มีคำว่า "กลุ่ม" หรือ "หมวด" หรือ "ประเภท" หรือชื่อความผิด
- ต้องการข้อมูลที่แยกตามกลุ่มแพลตฟอร์ม หรือแพลตฟอร์มที่ระบุ หรือประเทศที่ลงทะเบียนโดเมน
พารามิเตอร์: { query: string } (optional) — คำค้นหรือชื่อกลุ่มเพื่อกรองผล
ตัวอย่าง request: POST /api/urlstats/violation-groups-count { "query": "hate" }
ตัวอย่าง response:
  { "success": true, "data": [{ "group_name": "hate speech", "url_count": 618 }] }
ข้อผิดพลาดที่คาดได้: 401 (missing/invalid API key), 400 (invalid payload), 500 (internal error)
หมายเหตุ: ผลลัพธ์เป็น aggregate counts; อ่าน field 'group_name' และ 'url_count' เพื่อใช้งานต่อ`,
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "คำค้นหาหรือหมวดหมู่ที่ต้องการตรวจสอบ (Search term or category name)"
          ),
      }),
      outputSchema: z.object({
        success: z.boolean().describe("สถานะการดึงข้อมูล (Operation status)"),
        data: z
          .array(
            z.object({
              group_name: z
                .string()
                .describe("กลุ่ม/หมวดหมู่/ประเภท (Category name)"),
              url_count: z.number().describe("จำนวน URL (Number of URLs)"),
            })
          )
          .describe("รายการสถิติแยกตามกลุ่ม (Statistics by category)"),
      }),
    },
    async ({ query }, _extra) => {
      console.log(
        `[MCP Server] Webd count input and group tool request received at ${new Date().toLocaleString()}`
      );
      const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
      const webddsbPort = process.env.WEBDDSB_PORT || "3010";
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

        console.log("[MCP Server] CSRF token obtained");

        let setCookieHeaders: string[] = [];
        const cookiehdr =
          csrfRes.headers.get && csrfRes.headers.get("set-cookie");
        if (cookiehdr) {
          setCookieHeaders = [cookiehdr];
          console.log("[MCP Server] Set-Cookie header");
        } else {
          const cookies = csrfRes.headers.get("set-cookie");
          if (cookies) {
            setCookieHeaders = Array.isArray(cookies) ? cookies : [cookies];
            console.log("[MCP Server] Set-Cookie headers array");
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

        console.log("[MCP Server] POST request successful... fetching data");

        const data = await postRes.json();
        console.log("[MCP Server] Groups count data:", data);

        return {
          content: [
            { type: "text", text: JSON.stringify(data) } as {
              type: "text";
              text: string;
            },
          ],
          structuredContent: data,
        };
      } catch (error) {
        console.error("Error fetching groups count:", error);
        throw error;
      }
    }
  );

  mcpserver.registerTool(
    "webdTool_platforms",
    {
      title: "ดึงสถิติ URL แยกตามแพลตฟอร์ม",
      description: `
หน้าที่: คืนสัดส่วนและจำนวน URL แยกตามแพลตฟอร์ม (เช่น Facebook, Instagram, TikTok)
ใช้เมื่อ:
- ในคำขอของผู้ใช้มีคำว่า "แพลตฟอร์ม" หรือ "platform" หรือชื่อเว็บไซต์ หรือชื่อแพลตฟอร์ม
- ต้องการทราบการกระจายตัวของรายการตามแพลตฟอร์มเพื่อวิเคราะห์ช่องทางที่พบปัญหามากที่สุด
ไม่ใช้เมื่อ:
- ในคำขอของผู้ใช้ ไม่มีคำว่า "แพลตฟอร์ม" หรือ "platform" หรือชื่อเว็บไซต์ หรือชื่อแพลตฟอร์ม
- การขอข้อมูลที่เป็นรายวัน/รายเดือน หรือต้องการกรองตามคำสั่งศาล
- ต้องการแยกตามกลุ่มความผิด หรือประเทศที่จดทะเบียนโดเมน
พารามิเตอร์: { requestType?: string } (optional) — คำอธิบายชนิดข้อมูลแพลตฟอร์มที่ต้องการ (summary/detail)
ตัวอย่าง request: GET /api/urlstats/platforms
ตัวอย่าง response:
  { "success": true, "data": [{ "platform": "facebook", "url_count": 500, "percentage": 45.3 }] }
ข้อผิดพลาดที่คาดได้: 401 (API key), 500 (internal error)
หมายเหตุ: ฟิลด์ 'percentage' จะถูกคำนวณจาก 'url_count' หาก API ต้นทางไม่ส่งค่าเปอร์เซ็นต์มา`,
      inputSchema: z.object({
        requestType: z
          .string()
          .optional()
          .describe("ประเภทการขอข้อมูลแพลตฟอร์ม (Platform data request type)"),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        data: z.array(
          z.object({
            platform: z.string(),
            url_count: z.number(),
            percentage: z.number(),
          })
        ),
      }),
    },
    async ({ requestType }, _extra) => {
      console.log(
        `[MCP Server] Webd platforms tool request received at ${new Date().toLocaleString()}, requestType: ${
          requestType || "default"
        }`
      );
      const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
      const webddsbPort = process.env.WEBDDSB_PORT || "3010";
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

        console.log("[MCP Server] CSRF token obtained for platforms");

        // Extract set-cookie(s)
        let setCookieHeaders: string[] = [];
        const cookiehdr =
          csrfRes.headers.get && csrfRes.headers.get("set-cookie");
        if (cookiehdr) {
          setCookieHeaders = [cookiehdr];
          console.log("[MCP Server] Set-Cookie header");
        } else {
          const cookies =
            (csrfRes.headers as any).get && csrfRes.headers.get("set-cookie");
          if (cookies) {
            setCookieHeaders = Array.isArray(cookies) ? cookies : [cookies];
            console.log("[MCP Server] Set-Cookie headers array");
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
        console.log("[MCP Server] Platforms raw data:", data);

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
              console.log(
                "[MCP Server] Platforms data normalized with percentages:",
                data
              );
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
      } catch (error) {
        console.error("Error fetching platforms:", error);
        throw error;
      }
    }
  );

  // webdTool_register_country
  mcpserver.registerTool(
    "webdTool_register_country",
    {
      title: "ดึงสถิติ URL แยกตามประเทศที่จดทะเบียน",
      description: `
หน้าที่: คืนสถิติจำนวนและสัดส่วนของ URL แยกตามประเทศที่ลงทะเบียนโดเมน
ใช้เมื่อ:
- ในคำขอของผู้ใช้มีคำว่า "ประเทศ" หรือ "country" หรือ "ที่ตั้ง" หรือ "ที่อยู่" หรือ "ที่ไหน" หรือชื่อประเทศ 
- ต้องการวิเคราะห์การกระจายตามประเทศเพื่อตรวจสอบแหล่งที่มาของโดเมน/URL
ไม่ใช้เมื่อ: 
- ในคำขอของผู้ใช้ไม่มีคำว่า "ประเทศ" หรือ "country" หรือ "ที่ตั้ง" หรือ "ที่อยู่" หรือ "ที่ไหน" หรือชื่อประเทศ
- ต้องการข้อมูลที่เป็นรายวัน/รายเดือน หรือการกรองตามแพลตฟอร์ม/คำสั่งศาล
พารามิเตอร์: ไม่มี (GET)
ตัวอย่าง request: GET /api/urlstats/register-country
ตัวอย่าง response:
  { "success": true, "data": [{ "country": "TH", "url_count": 300, "percentage": 30.0 }] }
ข้อผิดพลาดที่คาดได้: 401 (API key), 500 (server error)
หมายเหตุ: หาก API ต้นทางไม่ส่ง 'percentage' ฟังก์ชันจะคำนวณให้โดยอัตโนมัติ`,
      inputSchema: z.object({}),
      outputSchema: z.object({
        success: z.boolean(),
        data: z.array(
          z.object({
            country: z.string(),
            url_count: z.number(),
            percentage: z.number(),
          })
        ),
      }),
    },
    async (_params, _extra) => {
      console.log(
        `[MCP Server] Webd register country tool request received at ${new Date().toLocaleString()}`
      );
      const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
      const webddsbPort = process.env.WEBDDSB_PORT || "3010";
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

        console.log("[MCP Server] CSRF token obtained for register country");

        // Extract set-cookie(s)
        let setCookieHeaders: string[] = [];
        const cookiehdr =
          csrfRes.headers.get && csrfRes.headers.get("set-cookie");
        if (cookiehdr) {
          setCookieHeaders = [cookiehdr];
          console.log("[MCP Server] Set-Cookie header");
        } else {
          const cookies =
            (csrfRes.headers as any).get && csrfRes.headers.get("set-cookie");
          if (cookies) {
            setCookieHeaders = Array.isArray(cookies) ? cookies : [cookies];
            console.log("[MCP Server] Set-Cookie headers array");
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
        console.log("[MCP Server] Register country raw data:", data);

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
              console.log(
                "[MCP Server] Register country data normalized with percentages:",
                data
              );
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
      } catch (error) {
        console.error("Error fetching register country:", error);
        throw error;
      }
    }
  );
}
