import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerWebdTools(mcpserver: McpServer) {
  // webdTool_count_by_group
  mcpserver.registerTool(
    "webdTool_count_all_input_by_group",
    {
      title: "ดึงจำนวนเว็บไซต์ผิดกฎหมายที่นำเข้าทั้งหมด",
      description: `หน้าที่: คืนสถิติจำนวนเว็บไซต์/URL ที่นำเข้าทั้งหมด แยกตามกลุ่มความผิด (category/group)
ใช้เมื่อ: ต้องการสถิติเชิงรวมแยกตามกลุ่มโดยไม่จำเป็นต้องกรองตามวันที่ แพลตฟอร์ม หรือสถานะคำสั่งศาล
ไม่ใช้เมื่อ: ต้องการข้อมูลที่กรองตามคำสั่งศาล, ช่วงวันที่, แพลตฟอร์มเฉพาะ หรือประเทศ
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

  // webdTool_count_court
  mcpserver.registerTool(
    "webdTool_count_court",
    {
      title: "ดึงจำนวนรายการเว็บไซต์ผิดกฎหมายที่มีคำสั่งศาล",
      description: `หน้าที่: คืนสถิติจำนวน URL/เว็บไซต์ที่มีคำสั่งศาล แยกตามกลุ่มความผิด
ใช้เมื่อ: ต้องการเฉพาะรายการที่มีคำสั่งศาล (court orders) เพื่อวิเคราะห์สัดส่วนหรือรายงาน
ไม่ใช้เมื่อ: ต้องการสถิติทั้งหมดรวมทั้งรายการที่ไม่มีคำสั่งศาล หรือต้องการกรองตามวันที่/แพลตฟอร์มโดยละเอียด
พารามิเตอร์: { query: string } (optional) — คำค้นหรือชื่อกลุ่มสำหรับการกรอง
ตัวอย่าง request: POST /api/urlstats/court-count { "query": "gambling" }
ตัวอย่าง response:
  { "success": true, "data": [{ "group_name": "gambling", "url_count": 123 }] }
ข้อผิดพลาดที่คาดได้: 401 (API key), 400 (invalid request body), 500 (server error)
หมายเหตุ: รูปแบบ response จะมี fields 'group_name' และ 'url_count'`,
      inputSchema: z.object({
        query: z.string().describe("คำค้นหาหรือหมวดหมู่ที่ต้องการตรวจสอบ"),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        data: z.array(
          z.object({
            group_name: z.string(),
            url_count: z.number(),
          })
        ),
      }),
    },
    async ({ query }, _extra) => {
      console.log(
        `[MCP Server] Webd count by court tool request received at ${new Date().toLocaleString()}`
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
          `http://${webddsbHost}:${webddsbPort}/api/urlstats/court-count`,
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
        console.log("[MCP Server]  count data:", data);

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
        console.error("Error fetching court count:", error);
        throw error;
      }
    }
  );

  // webdTool_petition_count
  mcpserver.registerTool(
    "webdTool_petition_count",
    {
      title: "ดึงจำนวน URL จากคำร้อง",
      description: `หน้าที่: คืนจำนวนรวมของ URL ที่มาจากคำร้อง (petition)
ใช้เมื่อ: ต้องการตัวเลขรวมของ URL ที่ถูกส่งเข้ามาผ่านคำร้อง/รายงาน ไม่คืนรายละเอียด URL แต่เป็นสถิติรวม
ไม่ใช้เมื่อ: ต้องการรายการ URL รายตัวหรือการแยกตามกลุ่ม/วันที่/แพลตฟอร์ม
พารามิเตอร์: ไม่มี (GET)
ตัวอย่าง request: GET /api/urlstats/petition-count
ตัวอย่าง response:
  { "success": true, "data": 452 }
ข้อผิดพลาดที่คาดได้: 401 (missing API key), 500 (internal error)
หมายเหตุ: endpoint นี้เป็น GET และไม่ต้องใช้ CSRF token`,
      inputSchema: z.object({}),
      outputSchema: z.object({
        success: z.boolean(),
        data: z.number(),
      }),
    },
    async (_params, _extra) => {
      console.log(
        `[MCP Server] Webd petition count tool request received at ${new Date().toLocaleString()}`
      );
      const webddsbHost = process.env.WEBDDSB_HOST || "localhost";
      const webddsbPort = process.env.WEBDDSB_PORT || "3010";
      const webddsbApiKey = process.env.WEBDDSB_APIKEY || "";
      try {
        const res = await fetch(
          `http://${webddsbHost}:${webddsbPort}/api/urlstats/petition-count`,
          {
            method: "GET",
            headers: { "x-api-key": webddsbApiKey },
          }
        );

        if (!res.ok) {
          throw new Error(`API request failed with status ${res.status}`);
        }

        const data = await res.json();
        console.log("[MCP Server] Petition count data:", data);

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
        console.error("Error fetching petition count:", error);
        throw error;
      }
    }
  );

  // webdTool_by_date_count
  mcpserver.registerTool(
    "webdTool_by_date_count",
    {
      title: "ดึงจำนวน URL แยกตามวันที่และประเภทความผิด",
      description: `หน้าที่: คืนสถิติจำนวน URL แยกตามวันที่และกลุ่มความผิด (date + group)
ใช้เมื่อ: ต้องการสถิติแบบ time-series ในช่วงวันที่กำหนด (aggregate per date และกลุ่ม)
ไม่ใช้เมื่อ: ต้องการสถิติแบบเดือนหรือกรองเฉพาะแพลตฟอร์ม/ประเทศโดยไม่สนใจวันที่
พารามิเตอร์: { startDate?: string (YYYY-MM-DD), endDate?: string (YYYY-MM-DD), sourceType?: string, selectedGroups?: string[] }
ตัวอย่าง request: POST /api/urlstats/by-date-count { "startDate": "2025-01-01", "endDate": "2025-01-31", "selectedGroups": ["hate speech"] }
ตัวอย่าง response:
  { "success": true, "data": [{ "date": "2025-01-01", "group_name": "hate speech", "url_count": 12 }] }
ข้อผิดพลาดที่คาดได้: 400 (invalid date format), 401 (API key), 500 (server error)
หมายเหตุ: วันที่คาดเป็นรูปแบบ YYYY-MM-DD; ผลรวมเป็น inclusive ของช่วงที่ส่งเข้ามา`,
      inputSchema: z.object({
        startDate: z
          .string()
          .optional()
          .describe("วันที่เริ่มต้น (YYYY-MM-DD)"),
        endDate: z.string().optional().describe("วันที่สิ้นสุด (YYYY-MM-DD)"),
        sourceType: z.string().optional().describe("ประเภทแหล่งที่มา"),
        selectedGroups: z
          .array(z.string())
          .optional()
          .describe("กลุ่มที่เลือก"),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        data: z.array(
          z.object({
            date: z.string(),
            group_name: z.string(),
            url_count: z.number(),
          })
        ),
      }),
    },
    async ({ startDate, endDate, sourceType, selectedGroups }, _extra) => {
      console.log(
        `[MCP Server] Webd by date count tool request received at ${new Date().toLocaleString()}`
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
          `http://${webddsbHost}:${webddsbPort}/api/urlstats/by-date-count`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": webddsbApiKey,
              "x-csrf-token": csrfToken,
              ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
            body: JSON.stringify({
              startDate,
              endDate,
              sourceType,
              selectedGroups,
            }),
          }
        );

        if (!postRes.ok) {
          throw new Error(`API request failed with status ${postRes.status}`);
        }

        const data = await postRes.json();
        console.log("[MCP Server] By date count data:", data);

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
        console.error("Error fetching by date count:", error);
        throw error;
      }
    }
  );

  // webdTool_by_month_count
  mcpserver.registerTool(
    "webdTool_by_month_count",
    {
      title: "ดึงจำนวน URL แยกตามเดือนและประเภทความผิด",
      description: `หน้าที่: คืนสถิติจำนวน URL แยกตามเดือนและกลุ่มความผิด (month + group)
ใช้เมื่อ: ต้องการภาพรวมเป็นรายเดือนของจำนวน URL สำหรับการรายงานหรือวิเคราะห์แนวโน้มเป็นเดือน
ไม่ใช้เมื่อ: ต้องการข้อมูลแบบรายวัน หรือข้อมูลที่ละเอียดตามแพลตฟอร์ม/ประเทศ/คำสั่งศาล
พารามิเตอร์: { startMonth?: string (YYYY-MM), endMonth?: string (YYYY-MM), sourceType?: string, selectedGroups?: string[] }
ตัวอย่าง request: POST /api/urlstats/by-month-count { "startMonth": "2025-01", "endMonth": "2025-03" }
ตัวอย่าง response:
  { "success": true, "data": [{ "month": "2025-01", "group_name": "gambling", "url_count": 120 }] }
ข้อผิดพลาดที่คาดได้: 400 (invalid month format), 401 (API key), 500 (server error)
หมายเหตุ: เดือนอยู่ในรูปแบบ YYYY-MM; ผลรวมมักจะเป็น inclusive ของช่วงเดือนที่ระบุ`,
      inputSchema: z.object({
        startMonth: z.string().optional().describe("เดือนเริ่มต้น (YYYY-MM)"),
        endMonth: z.string().optional().describe("เดือนสิ้นสุด (YYYY-MM)"),
        sourceType: z.string().optional().describe("ประเภทแหล่งที่มา"),
        selectedGroups: z
          .array(z.string())
          .optional()
          .describe("กลุ่มที่เลือก"),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        data: z.array(
          z.object({
            month: z.string(),
            group_name: z.string(),
            url_count: z.number(),
          })
        ),
      }),
    },
    async ({ startMonth, endMonth, sourceType, selectedGroups }, _extra) => {
      console.log(
        `[MCP Server] Webd by month count tool request received at ${new Date().toLocaleString()}`
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
          `http://${webddsbHost}:${webddsbPort}/api/urlstats/by-month-count`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": webddsbApiKey,
              "x-csrf-token": csrfToken,
              ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
            body: JSON.stringify({
              startMonth,
              endMonth,
              sourceType,
              selectedGroups,
            }),
          }
        );

        if (!postRes.ok) {
          throw new Error(`API request failed with status ${postRes.status}`);
        }

        const data = await postRes.json();
        console.log("[MCP Server] By month count data:", data);

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
        console.error("Error fetching by month count:", error);
        throw error;
      }
    }
  );

  // webdTool_platforms
  mcpserver.registerTool(
    "webdTool_platforms",
    {
      title: "ดึงสถิติ URL แยกตามแพลตฟอร์ม",
      description: `หน้าที่: คืนสัดส่วนและจำนวน URL แยกตามแพลตฟอร์ม (เช่น Facebook, Instagram, TikTok)
ใช้เมื่อ: ต้องการทราบการกระจายตัวของรายการตามแพลตฟอร์มเพื่อวิเคราะห์ช่องทางที่พบปัญหามากที่สุด
ไม่ใช้เมื่อ: ต้องการแยกตามวันที่ รายเดือน ประเทศ หรือคำสั่งศาล (ใช้ endpoints อื่นสำหรับ time-series หรือ court-filter)
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
        const res = await fetch(
          `http://${webddsbHost}:${webddsbPort}/api/urlstats/platforms`,
          {
            method: "GET",
            headers: { "x-api-key": webddsbApiKey },
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
      description: `หน้าที่: คืนสถิติจำนวนและสัดส่วนของ URL แยกตามประเทศที่ลงทะเบียนโดเมน
ใช้เมื่อ: ต้องการวิเคราะห์การกระจายตามประเทศเพื่อตรวจสอบแหล่งที่มาของโดเมน/URL
ไม่ใช้เมื่อ: ต้องการข้อมูลที่เป็นรายวัน/รายเดือนหรือการกรองตามแพลตฟอร์ม/คำสั่งศาล
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
        const res = await fetch(
          `http://${webddsbHost}:${webddsbPort}/api/urlstats/register-country`,
          {
            method: "GET",
            headers: { "x-api-key": webddsbApiKey },
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
