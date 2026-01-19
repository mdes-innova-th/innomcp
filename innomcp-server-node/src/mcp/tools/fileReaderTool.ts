import { z } from "zod";
import PDFParser from "pdf-parse";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * File Reader Tool - อ่านไฟล์ PDF, Excel, Word
 * รองรับ: PDF, XLSX, XLS, DOCX
 * ฟรี 100% - ไม่ต้อง API key
 */

export const fileReaderToolSchema = z.object({
  filePath: z.string().describe("Path หรือ base64 ของไฟล์ที่ต้องการอ่าน"),
  fileType: z.enum(["pdf", "excel", "word", "auto"]).describe("ชนิดของไฟล์: pdf, excel (xlsx/xls), word (docx), auto (ตรวจจับอัตโนมัติ)"),
  options: z.object({
    maxPages: z.number().optional().describe("จำนวนหน้าสูงสุดที่จะอ่าน (PDF only)"),
    sheetName: z.string().optional().describe("ชื่อ sheet ที่ต้องการอ่าน (Excel only)"),
    includeImages: z.boolean().optional().describe("รวมรูปภาพด้วยหรือไม่ (Word only)"),
  }).optional(),
});

export type FileReaderInput = z.infer<typeof fileReaderToolSchema>;

export const fileReaderTool = {
  name: "fileReaderTool",
  description: `
หน้าที่: อ่านเนื้อหาจากไฟล์ PDF, Excel, Word
ใช้เมื่อ:
- ต้องการอ่านเอกสาร PDF
- วิเคราะห์ข้อมูลจาก Excel spreadsheet
- แปลง Word document เป็นข้อความ
- Extract ข้อมูลจากเอกสารต่างๆ

รองรับไฟล์:
- PDF: อ่านข้อความจาก PDF files
- Excel: XLSX, XLS (รองรับหลาย sheets)
- Word: DOCX (รองรับ text + tables)

คุณสมบัติ:
- ฟรี 100% (ไม่ต้อง API key)
- Offline capable
- อ่านได้หลายหน้า
- รองรับภาษาไทย/อังกฤษ

ตัวอย่าง:
- "อ่านไฟล์ PDF report.pdf"
- "ดึงข้อมูลจาก Excel data.xlsx"
- "แปลง Word document.docx เป็นข้อความ"
- "อ่านหน้าแรกของ PDF"
- "ดูข้อมูลใน sheet 'Summary' ของ Excel"

Options:
- PDF: maxPages (จำกัดจำนวนหน้า)
- Excel: sheetName (เลือก sheet)
- Word: includeImages (รวมรูปภาพ)
`,
  inputSchema: fileReaderToolSchema,

  execute: async (args: unknown) => {
    // Validate input
    const parsed = fileReaderToolSchema.safeParse(args);
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
      const { filePath, fileType, options = {} } = input;

      // Validate file path
      if (!filePath || filePath.trim().length === 0) {
        throw new Error("กรุณาระบุ file path");
      }

      // Determine file type
      let detectedType = fileType;
      if (fileType === "auto") {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === ".pdf") detectedType = "pdf";
        else if ([".xlsx", ".xls"].includes(ext)) detectedType = "excel";
        else if (ext === ".docx") detectedType = "word";
        else throw new Error(`ไม่รองรับไฟล์ชนิด ${ext}`);
      }

      console.log(`[File Reader] Processing ${detectedType} file: ${filePath}`);

      let content: any;
      let metadata: any = {};

      // Read file based on type
      switch (detectedType) {
        case "pdf":
          content = await readPDF(filePath, options);
          metadata = { type: "pdf", pages: content.pages };
          break;
        
        case "excel":
          content = await readExcel(filePath, options);
          metadata = { type: "excel", sheets: content.sheetNames };
          break;
        
        case "word":
          content = await readWord(filePath, options);
          metadata = { type: "word" };
          break;
        
        default:
          throw new Error(`ไม่รองรับไฟล์ชนิด ${detectedType}`);
      }

      const result = {
        filePath,
        fileType: detectedType,
        content,
        metadata,
        success: true,
        timestamp: new Date().toISOString()
      };

      console.log(`[File Reader] Success: Read ${detectedType} file`);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการอ่านไฟล์";
      console.error(`[File Reader] Error: ${errorMessage}`);
      
      const errorResult = {
        filePath: input.filePath,
        fileType: input.fileType,
        content: null,
        metadata: {},
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
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

// Helper: Read PDF
async function readPDF(filePath: string, options: any = {}) {
  const dataBuffer = await fs.readFile(filePath);
  const pdfData: any = await (PDFParser as any)(dataBuffer, {
    max: options.maxPages || undefined
  });

  return {
    text: pdfData.text,
    pages: pdfData.numpages,
    info: pdfData.info,
    metadata: pdfData.metadata
  };
}

// Helper: Read Excel
async function readExcel(filePath: string, options: any = {}) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = options.sheetName || workbook.SheetNames[0];
  
  if (!workbook.Sheets[sheetName]) {
    throw new Error(`ไม่พบ sheet '${sheetName}'`);
  }

  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  const json = XLSX.utils.sheet_to_json(worksheet);

  return {
    sheetName,
    sheetNames: workbook.SheetNames,
    data,
    json,
    rowCount: data.length,
    columnCount: data[0] ? (data[0] as any[]).length : 0
  };
}

// Helper: Read Word
async function readWord(filePath: string, options: any = {}) {
  const dataBuffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer: dataBuffer });

  return {
    text: result.value,
    messages: result.messages,
    warnings: result.messages.filter((m) => m.type === "warning")
  };
}

export default fileReaderTool;
