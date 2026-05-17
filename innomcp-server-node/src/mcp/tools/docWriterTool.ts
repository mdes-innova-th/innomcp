import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle } from "docx";
import PDFDocument from "pdfkit";

/**
 * Document Writer Tool — generates DOCX, PDF, or Markdown files from
 * structured content. Writes to the sandboxed workspace-storage dir
 * (same root as storageTool) for safety.
 *
 * Supports:
 * - Headings (h1..h4)
 * - Paragraphs (with optional bold/italic via markdown-lite)
 * - Bullet / numbered lists
 * - Simple tables
 * - Page breaks
 */

const STORAGE_ROOT = path.resolve(process.cwd(), "..", "workspace-storage");

(async () => {
  try { await fs.mkdir(STORAGE_ROOT, { recursive: true }); } catch {}
})();

const BlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), level: z.number().min(1).max(4).default(1), text: z.string() }),
  z.object({ type: z.literal("paragraph"), text: z.string() }),
  z.object({ type: z.literal("list"), ordered: z.boolean().optional(), items: z.array(z.string()) }),
  z.object({ type: z.literal("table"), rows: z.array(z.array(z.string())), hasHeader: z.boolean().optional() }),
  z.object({ type: z.literal("pageBreak") }),
]);

export const docWriterToolSchema = z.object({
  filename: z.string().describe("Output filename — must end with .docx, .pdf, or .md"),
  title: z.string().optional().describe("Document title (rendered as H1 at top if no other heading)"),
  blocks: z.array(BlockSchema).describe("Ordered content blocks"),
  metadata: z.object({
    author: z.string().optional(),
    subject: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  }).optional(),
});

export type DocWriterInput = z.infer<typeof docWriterToolSchema>;

function safePath(filename: string): string {
  const safe = path.basename(filename);
  return path.join(STORAGE_ROOT, safe);
}

function getExt(filename: string): "docx" | "pdf" | "md" | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".md")) return "md";
  return null;
}

/** Render blocks → DOCX Buffer */
async function buildDocx(input: DocWriterInput): Promise<Buffer> {
  const children: any[] = [];
  if (input.title) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: input.title, bold: true, size: 36 })],
    }));
  }
  for (const block of input.blocks) {
    if (block.type === "heading") {
      const headingMap: Record<number, any> = {
        1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3, 4: HeadingLevel.HEADING_4,
      };
      children.push(new Paragraph({
        heading: headingMap[block.level] ?? HeadingLevel.HEADING_2,
        children: [new TextRun({ text: block.text, bold: true })],
      }));
    } else if (block.type === "paragraph") {
      children.push(new Paragraph({ children: [new TextRun({ text: block.text })] }));
    } else if (block.type === "list") {
      for (const item of block.items) {
        children.push(new Paragraph({
          bullet: block.ordered ? undefined : { level: 0 },
          numbering: block.ordered ? { reference: "ordered", level: 0 } : undefined,
          children: [new TextRun({ text: item })],
        }));
      }
    } else if (block.type === "table") {
      const rows = block.rows.map((cells, i) => new TableRow({
        children: cells.map((c) => new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: c, bold: i === 0 && !!block.hasHeader })] })],
        })),
      }));
      children.push(new Table({
        rows,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
          left: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
          insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
        },
      }));
    } else if (block.type === "pageBreak") {
      children.push(new Paragraph({ children: [new TextRun({ text: "", break: 1 })], pageBreakBefore: true }));
    }
  }
  const doc = new Document({
    title: input.title || input.filename,
    creator: input.metadata?.author || "INNOMCP",
    subject: input.metadata?.subject,
    keywords: input.metadata?.keywords?.join(", "),
    sections: [{ properties: {}, children }],
  });
  return await Packer.toBuffer(doc);
}

/** Render blocks → PDF Buffer */
function buildPdf(input: DocWriterInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const info: Record<string, string> = {
      Title: input.title || input.filename,
      Author: input.metadata?.author || "INNOMCP",
    };
    if (input.metadata?.subject) info.Subject = input.metadata.subject;
    if (input.metadata?.keywords?.length) info.Keywords = input.metadata.keywords.join(", ");
    const doc = new PDFDocument({ size: "A4", margin: 50, info });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (input.title) {
      doc.fontSize(22).font("Helvetica-Bold").text(input.title, { align: "center" });
      doc.moveDown(1);
    }
    for (const block of input.blocks) {
      if (block.type === "heading") {
        const sizes = { 1: 20, 2: 16, 3: 14, 4: 12 } as Record<number, number>;
        doc.moveDown(0.5);
        doc.fontSize(sizes[block.level] ?? 14).font("Helvetica-Bold").text(block.text);
        doc.moveDown(0.3);
      } else if (block.type === "paragraph") {
        doc.fontSize(11).font("Helvetica").text(block.text, { align: "left" });
        doc.moveDown(0.3);
      } else if (block.type === "list") {
        doc.fontSize(11).font("Helvetica");
        block.items.forEach((it, i) => {
          const marker = block.ordered ? `${i + 1}. ` : "• ";
          doc.text(`${marker}${it}`, { indent: 14 });
        });
        doc.moveDown(0.3);
      } else if (block.type === "table") {
        doc.fontSize(10).font("Helvetica");
        const cellWidth = (doc.page.width - 100) / Math.max(1, block.rows[0]?.length ?? 1);
        for (let r = 0; r < block.rows.length; r++) {
          const startY = doc.y;
          block.rows[r].forEach((cell, c) => {
            const x = 50 + c * cellWidth;
            doc.rect(x, startY, cellWidth, 22).strokeColor("#cccccc").stroke();
            doc.font(r === 0 && block.hasHeader ? "Helvetica-Bold" : "Helvetica");
            doc.text(cell, x + 4, startY + 6, { width: cellWidth - 8, ellipsis: true });
          });
          doc.y = startY + 22;
        }
        doc.moveDown(0.5);
      } else if (block.type === "pageBreak") {
        doc.addPage();
      }
    }
    doc.end();
  });
}

/** Render blocks → Markdown string */
function buildMarkdown(input: DocWriterInput): string {
  const lines: string[] = [];
  if (input.title) lines.push(`# ${input.title}`, "");
  for (const block of input.blocks) {
    if (block.type === "heading") {
      const hashes = "#".repeat(block.level);
      lines.push(`${hashes} ${block.text}`, "");
    } else if (block.type === "paragraph") {
      lines.push(block.text, "");
    } else if (block.type === "list") {
      block.items.forEach((it, i) => {
        lines.push(block.ordered ? `${i + 1}. ${it}` : `- ${it}`);
      });
      lines.push("");
    } else if (block.type === "table") {
      if (block.rows.length > 0) {
        lines.push(`| ${block.rows[0].join(" | ")} |`);
        lines.push(`|${block.rows[0].map(() => " --- ").join("|")}|`);
        for (let r = 1; r < block.rows.length; r++) {
          lines.push(`| ${block.rows[r].join(" | ")} |`);
        }
        lines.push("");
      }
    } else if (block.type === "pageBreak") {
      lines.push("\n---\n");
    }
  }
  return lines.join("\n");
}

export const docWriterTool = {
  name: "docWriterTool",
  description: `
หน้าที่: สร้างเอกสาร DOCX, PDF, หรือ Markdown จากเนื้อหาเชิงโครงสร้าง
ใช้เมื่อ:
- สร้างรายงานเป็นไฟล์ Word/PDF
- ส่งออกผลลัพธ์ AI เป็นเอกสารทางการ
- ทำสรุปการประชุม / executive summary เป็นไฟล์แชร์ได้
- เตรียมเอกสารพร้อมหัวข้อ ตาราง รายการ

รองรับ blocks:
- heading (level 1-4)
- paragraph
- list (bullet หรือ numbered)
- table (พร้อม header แถวแรก)
- pageBreak

ไฟล์ที่เซฟ:
- .docx → Microsoft Word
- .pdf → Adobe PDF
- .md → Markdown

ตัวอย่าง:
  filename: "summary.docx"
  title: "สรุปการประชุม 14 พ.ค. 2569"
  blocks:
    - { type: "heading", level: 1, text: "วาระประชุม" }
    - { type: "list", items: ["ทบทวน OKR", "อนุมัติงบประมาณ", "นัดถัดไป"] }
    - { type: "paragraph", text: "ที่ประชุมเห็นชอบ..." }
`,
  inputSchema: docWriterToolSchema,
  execute: async (rawArgs: unknown) => {
    const parsed = docWriterToolSchema.safeParse(rawArgs);
    if (!parsed.success) {
      const text = JSON.stringify({ success: false, error: "invalid input", details: parsed.error.issues });
      return { content: [{ type: "text" as const, text }], isError: true };
    }
    const input = parsed.data;
    const ext = getExt(input.filename);
    if (!ext) {
      const text = JSON.stringify({ success: false, error: "filename must end with .docx, .pdf, or .md" });
      return { content: [{ type: "text" as const, text }], isError: true };
    }
    try {
      const filePath = safePath(input.filename);
      let bytesWritten: number;
      if (ext === "docx") {
        const buf = await buildDocx(input);
        await fs.writeFile(filePath, buf);
        bytesWritten = buf.length;
      } else if (ext === "pdf") {
        const buf = await buildPdf(input);
        await fs.writeFile(filePath, buf);
        bytesWritten = buf.length;
      } else {
        const md = buildMarkdown(input);
        await fs.writeFile(filePath, md, "utf-8");
        bytesWritten = Buffer.byteLength(md, "utf-8");
      }
      const payload = {
        success: true,
        filename: path.basename(input.filename),
        format: ext,
        bytes: bytesWritten,
        path: filePath,
        blockCount: input.blocks.length,
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
    } catch (err) {
      const text = JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) });
      return { content: [{ type: "text" as const, text }], isError: true };
    }
  },
};

export function registerDocWriterTool(server: McpServer) {
  server.registerTool(
    docWriterTool.name,
    {
      title: "Document Writer — สร้างเอกสาร DOCX / PDF / Markdown",
      description: docWriterTool.description,
      inputSchema: docWriterTool.inputSchema as any,
    },
    docWriterTool.execute,
  );
}
