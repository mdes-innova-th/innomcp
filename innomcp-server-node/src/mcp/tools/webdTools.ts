import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerWebdTools(mcpserver: McpServer) {
  // webdTool_count_by_group
  mcpserver.registerTool(
    "webdTool_count_all_input_by_group",
    {
      title: "ดึงจำนวนเว็บไซต์ผิดกฎหมายที่นำเข้าทั้งหมด",
      description: `ดึงจำนวนเว็บไซต์ผิดกฎหมายที่นำเข้าทั้งหมด แยกตามกลุ่ม
      ใช้เมื่อ: ต้องการดึงสถิติจำนวนเว็บไซต์ผิดกฎหมายที่ถูกจัดหมวดหมู่ตามกลุ่มต่างๆ ที่นำเข้าทั้งหมด, คำถามไม่ได้ระบุเฉพาะเจาะจงว่าต้องการแยกตามวัน/เดือน/ปี/แพลตฟอร์ม/ประเทศ/มีคำสั่งศาลหรือไม่
      ไม่ใช้เมื่อ: ต้องการดึงข้อมูลที่มีคำสั่งศาล หรือแยกตามวัน/เดือน/ปี หรือต้องการจำนวนแยกตามแพลตฟอร์ม หรือระบุแพลตฟอร์มเฉพาะ (Facebook, Instagram ฯลฯ) หรือแยกตามประเทศ
      ข้อมูลที่ได้รับ: group_name (กลุ่ม/หมวดหมู่/ประเภท) และ url_count (จำนวน URL/จำนวนเว็บไซต์/จำนวนรายการ)
      Example response:
      {
      "success": true,
      "data": [
        { "group_name": "hate speech", "url_count": 618 },
        { "group_name": "gambling", "url_count": 1523 }
      ]
    }`,
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
      description: "ดึงจำนวนรายการเว็บไซต์ผิดกฎหมายที่มีคำสั่งศาล",
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
      description: "ดึงจำนวน URL จากคำร้อง",
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
      description: "ดึงจำนวน URL แยกตามวันที่และประเภทความผิด",
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
      description: "ดึงจำนวน URL แยกตามเดือนและประเภทความผิด",
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
      description: `ดึงสถิติ URL แยกตามแพลตฟอร์ม (เช่น Facebook, Instagram, TikTok, YouTube)
      ใช้เมื่อ: ผู้ใช้ถามเฉพาะเจาะจงเกี่ยวกับแพลตฟอร์มโซเชียลมีเดีย หรือ platform หรือต้องการดูสัดส่วนการกระจายตัวของเว็บไซต์ตามแพลตฟอร์ม
      ไม่ใช้เมื่อ: ถามเกี่ยวกับหมวดหมู่/กลุ่ม, วันที่/เดือน, ประเทศ, หรือคำถามทั่วไปเกี่ยวกับสถิติ
      ข้อมูลที่ได้รับ: platform (ชื่อแพลตฟอร์ม), url_count (จำนวน), percentage (เปอร์เซ็นต์)`,
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
      description: "ดึงสถิติ URL แยกตามประเทศที่จดทะเบียน",
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
