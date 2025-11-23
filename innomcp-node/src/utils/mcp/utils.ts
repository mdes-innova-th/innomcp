/**
 * MCPClient Utility Functions
 * Helper functions for data extraction, validation, and processing
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeSanitize from "rehype-sanitize";
import { MCPTool, MCPResource } from "./types";

/**
 * ดึงเลขตัวเลขจากประวัติการสนทนาสำหรับกราฟ
 */
export function extractChartDataFromHistory(
  conversationHistory: Array<{ query: string; tools: string[]; timestamp: number }>
): string {
  if (conversationHistory.length === 0) return "";

  let dataContext = "";

  // รวมข้อมูลจากประวัติการสนทนา
  const textContent = conversationHistory
    .map((ctx) => ctx.query)
    .join("\n");

  if (!textContent) return "";

  // ค้นหาข้อมูลที่มีลักษณะเป็นตัวเลข (label value)
  const patterns = [
    /([A-Z][a-z]*(?:\s+[a-z]+)*)\s*[:|\s]+\s*(\d+(?:\.\d+)?)/gi, // "Sales: 100"
    /([ก-ฮ][ก-ฮะะ]*)\s*[:|\s]+\s*(\d+(?:\.\d+)?)/g, // ข้อมูลไทย
  ];

  const allMatches: Array<{ label: string; value: string }> = [];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(textContent)) !== null) {
      allMatches.push({
        label: match[1].trim(),
        value: match[2],
      });
    }
  }

  // ลบค่าซ้ำและสร้าง context
  if (allMatches.length > 0) {
    const uniqueData = new Map<string, string>();
    allMatches.forEach((m) => {
      if (!uniqueData.has(m.label)) {
        uniqueData.set(m.label, m.value);
      }
    });

    dataContext = Array.from(uniqueData.entries())
      .map(([label, value]) => `${label} ${value}`)
      .join(", ");

    console.log(
      `[MCP Client] Extracted chart data from history: ${dataContext}`
    );
  }

  return dataContext;
}

/**
 * ดึงข้อมูล JSON จากข้อความ
 */
export function extractJsonFromText(text: string): string | null {
  if (!text || typeof text !== "string") return null;

  const firstIdx = text.search(/[\{\[]/);
  if (firstIdx === -1) return null;

  const openChar = text[firstIdx];
  const closeChar = openChar === "{" ? "}" : "]";

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = firstIdx; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\") {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        return text.slice(firstIdx, i + 1).trim();
      }
    }
  }

  return null;
}

/**
 * ทำให้เนื้อหา Markdown เป็น HTML
 */
export function markdownToHtml(markdown: string): string {
  try {
    const processed = unified()
      .use(remarkParse as any)
      .use(remarkRehype as any, { allowDangerousHtml: false } as any)
      .use(rehypeSanitize as any)
      .use(rehypeStringify as any, { allowDangerousHtml: false } as any)
      .processSync(markdown as any);

    return String(processed);
  } catch (error) {
    console.error("Error converting Markdown to HTML:", error);
    return markdown;
  }
}

/**
 * ตรวจสอบความถูกต้องของ arguments ตาม schema
 */
export function validateArguments(
  args: any,
  schema: any,
  ajv: any
): { valid: boolean; errors?: string[] } {
  const validate = ajv.compile(schema);
  const valid = validate(args);

  if (!valid && validate.errors) {
    return {
      valid: false,
      errors: validate.errors.map((e: any) => `${e.instancePath} ${e.message}`),
    };
  }

  return { valid: true };
}

/**
 * สร้างคำอธิบาย tools
 */
export async function getToolDescriptions(
  tools: Map<string, MCPTool>,
  resources?: Map<string, MCPResource>,
  userMessage?: string,
  scoreToolRelevance?: (toolName: string, message: string) => Promise<number>
): Promise<string> {
  let descriptions = "**Tools**:\n";

  const toolList = Array.from(tools.values());

  let scoredTools: Array<{ tool: MCPTool; score?: number }> = toolList.map(
    (tool) => ({
      tool,
    })
  );

  if (userMessage && scoreToolRelevance) {
    const scorePromises = toolList.map(async (tool) => {
      const fullName =
        Array.from(tools.entries()).find(([, t]) => t === tool)?.[0] ||
        tool.name;
      const score = await scoreToolRelevance(fullName, userMessage);
      return { tool, score };
    });

    scoredTools = await Promise.all(scorePromises);
    scoredTools.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  descriptions += scoredTools
    .map(({ tool, score }) => {
      const scoreText =
        score !== undefined ? ` (คะแนน: ${score.toFixed(2)})` : "";
      return `- ${tool.name}${scoreText}
  คำอธิบาย: ${tool.description}
  หมวดหมู่: ${tool.category}
  ตัวอย่าง: ${tool.examples.slice(0, 2).join(", ")}`;
    })
    .join("\n\n");

  if (resources && resources.size > 0) {
    descriptions += "\n\n**Resources**:\n";

    const resourceList = Array.from(resources.values());
    let scoredResources: Array<{ resource: MCPResource; score?: number }> =
      resourceList.map((resource) => ({ resource }));

    if (userMessage && scoreToolRelevance) {
      const scorePromises = resourceList.map(async (resource) => {
        const fullName =
          Array.from(resources.entries()).find(
            ([, r]) => r === resource
          )?.[0] || resource.name;
        const score = await scoreToolRelevance(fullName, userMessage);
        return { resource, score };
      });

      scoredResources = await Promise.all(scorePromises);
      scoredResources.sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    descriptions += scoredResources
      .map(({ resource, score }) => {
        const scoreText =
          score !== undefined ? ` (คะแนน: ${score.toFixed(2)})` : "";
        return `- ${resource.name}${scoreText}
  คำอธิบาย: ${resource.description || "ไม่มีคำอธิบาย"}
  ประเภท: Resource`;
      })
      .join("\n\n");
  }

  return descriptions;
}

/**
 * สร้าง enhanced context จากผลลัพธ์ tools
 */
export function createEnhancedContext(
  userMessage: string,
  toolResults: any[]
): string {
  let context = `คำถาม: "${userMessage}"\n\nข้อมูลจาก Tools:\n\n`;

  for (const result of toolResults) {
    if (result.error) {
      context += `❌ ${result.toolName}: ${result.error}\n`;
    } else {
      const resultStr =
        typeof result.result === "string"
          ? result.result
          : JSON.stringify(result.result, null, 2);
      context += `✅ ${result.toolName}:\n${resultStr}\n\n`;
    }
  }

  return context;
}

/**
 * ทำให้ข้อมูล parameters บริสุทธิ์ (ลบฟิลด์ที่ไม่ใช่ parameters)
 */
export function cleanParametersObject(parsed: any): any {
  const invalidFields = [
    "success",
    "data",
    "markdown",
    "error",
    "result",
  ];

  for (const field of invalidFields) {
    if (field in parsed) delete parsed[field];
  }

  // ลบ numeric keys
  for (const key of Object.keys(parsed)) {
    if (/^\d+$/.test(key)) delete parsed[key];
  }

  return parsed;
}

/**
 * เติม required fields ที่ขาดหาย
 */
export function fillRequiredFields(
  parsed: any,
  schema: any,
  required: string[]
): any {
  for (const key of required) {
    if (!(key in parsed)) {
      parsed[key] = schema.properties?.[key]?.default ?? "";
    }
  }

  return parsed;
}
