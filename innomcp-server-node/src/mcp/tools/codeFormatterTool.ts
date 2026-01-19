import { z } from "zod";
import * as prettier from "prettier";

/**
 * Code Formatter Tool
 * Formats code using Prettier
 * Supports: JS, TS, JSON, CSS, HTML, Markdown, YAML, etc.
 */

// Supported languages
const SUPPORTED_LANGUAGES = [
  "javascript", "js",
  "typescript", "ts",
  "json",
  "css", "scss", "less",
  "html",
  "markdown", "md",
  "yaml", "yml",
  "graphql"
];

export const codeFormatterToolSchema = z.object({
  code: z.string().describe("โค้ดที่ต้องการ format"),
  language: z.string().describe(`ภาษาของโค้ด (เช่น javascript, typescript, json, css, html). รองรับ: ${SUPPORTED_LANGUAGES.join(", ")}`),
  tabWidth: z.number().optional().describe("ขนาด tab (default: 2)"),
  useTabs: z.boolean().optional().describe("ใช้ tabs แทน spaces (default: false)"),
  singleQuote: z.boolean().optional().describe("ใช้ single quote แทน double quote (default: true)"),
});

export type CodeFormatterInput = z.infer<typeof codeFormatterToolSchema>;

export const codeFormatterTool = {
  name: "codeFormatterTool",
  description: `
หน้าที่: Format โค้ดให้สวยงามและมีรูปแบบมาตรฐานด้วย Prettier
ใช้เมื่อ:
- โค้ดไม่เป็นระเบียบ ยุ่ง อ่านยาก
- ต้องการให้โค้ดเป็นไปตาม coding standards
- จัดระเบียบ indentation, spacing, line breaks
- ทำให้โค้ดอ่านง่ายขึ้น

รองรับภาษา:
- JavaScript (.js)
- TypeScript (.ts)
- JSON (.json)
- CSS/SCSS/Less
- HTML
- Markdown (.md)
- YAML (.yml)
- GraphQL

คุณสมบัติ:
- Auto-fix syntax issues
- Consistent formatting
- Configurable options (tab width, quotes, semicolons)

ตัวอย่าง:
- "format โค้ด JavaScript นี้"
- "จัด format โค้ด TypeScript ให้สวย"
- "format JSON นี้ให้อ่านง่าย"
- "ทำให้โค้ด CSS สวยขึ้น"
`,
  inputSchema: codeFormatterToolSchema,

  execute: async (args: unknown) => {
    // Validate input
    const parsed = codeFormatterToolSchema.safeParse(args);
    if (!parsed.success) {
      const errorText = JSON.stringify({
        success: false,
        error: "Invalid input",
        details: parsed.error.issues
      }, null, 2);
      return {
        content: [{ type: "text" as const, text: errorText }]
      };
    }

    const input = parsed.data;
    
    try {
      const { 
        code, 
        language, 
        tabWidth = 2, 
        useTabs = false, 
        singleQuote = true 
      } = input;

      // Validate input
      if (!code || code.trim().length === 0) {
        throw new Error("กรุณาระบุโค้ดที่ต้องการ format");
      }

      if (code.length > 50000) {
        throw new Error("โค้ดยาวเกินไป (สูงสุด 50,000 ตัวอักษร)");
      }

      // Normalize language name
      const lang = language.toLowerCase();

      // Map language to Prettier parser
      const parserMap: Record<string, string> = {
        "javascript": "babel",
        "js": "babel",
        "typescript": "typescript",
        "ts": "typescript",
        "json": "json",
        "css": "css",
        "scss": "scss",
        "less": "less",
        "html": "html",
        "markdown": "markdown",
        "md": "markdown",
        "yaml": "yaml",
        "yml": "yaml",
        "graphql": "graphql"
      };

      const parser = parserMap[lang];

      if (!parser) {
        throw new Error(`ไม่รองรับภาษา: ${language}. รองรับ: ${SUPPORTED_LANGUAGES.join(", ")}`);
      }

      // Count lines before
      const linesBefore = code.split("\n").length;

      // Format code with Prettier
      const formattedCode = await prettier.format(code, {
        parser,
        tabWidth,
        useTabs,
        singleQuote,
        trailingComma: "es5",
        printWidth: 80,
        semi: true,
        bracketSpacing: true,
        arrowParens: "always"
      });

      // Count lines after
      const linesAfter = formattedCode.split("\n").length;

      const result = {
        originalCode: code,
        formattedCode,
        language: lang,
        linesBefore,
        linesAfter,
        success: true
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการ format โค้ด";
      console.error(`[Code Formatter Tool] Error: ${errorMessage}`);
      
      const errorResult = {
        originalCode: input.code,
        formattedCode: input.code, // Return original if formatting fails
        language: input.language,
        linesBefore: input.code.split("\n").length,
        linesAfter: input.code.split("\n").length,
        success: false,
        error: errorMessage
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(errorResult, null, 2)
          }
        ]
      };
    }
  }
};

export default codeFormatterTool;
