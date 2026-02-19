import { z } from "zod";
import QRCode from "qrcode";

/**
 * QR Code Generator Tool
 * Generates QR codes from text/URLs
 * Output: Base64-encoded PNG image
 */

export const qrCodeToolSchema = z.object({
  text: z.string().describe("ข้อความหรือ URL ที่ต้องการสร้าง QR code (เช่น https://example.com, สวัสดี)"),
  size: z.number().optional().describe("ขนาดของ QR code ในพิกเซล (default: 300, max: 1000)"),
  errorCorrectionLevel: z.enum(["L", "M", "Q", "H"]).optional().describe("ระดับการแก้ไขข้อผิดพลาด: L=7%, M=15%, Q=25%, H=30% (default: M)"),
});

export type QRCodeInput = z.infer<typeof qrCodeToolSchema>;

export const qrCodeTool = {
  name: "qrCodeTool",
  description: `
หน้าที่: สร้าง QR code จากข้อความหรือ URL
ใช้เมื่อ:
- ต้องการสร้าง QR code สำหรับแชร์ลิงก์
- สร้าง QR code สำหรับ Wi-Fi, ข้อความ, ข้อมูลติดต่อ
- สร้าง QR code สำหรับชำระเงิน (PromptPay, PayPal)
- แปลงข้อมูลเป็น QR code เพื่อให้สแกนได้ง่าย

คุณสมบัติ:
- รองรับข้อความภาษาไทย/อังกฤษ/อื่นๆ
- รองรับ URL, Email, เบอร์โทร
- ปรับขนาดได้ (100-1000 pixels)
- Error correction levels: L, M, Q, H

ตัวอย่าง:
- "สร้าง QR code สำหรับ https://innomcp.com"
- "ทำ QR code ข้อความ สวัสดีครับ"
- "QR code เบอร์โทร 0812345678"
- "สร้าง QR code PromptPay 0812345678"
`,
  inputSchema: qrCodeToolSchema,

  execute: async (args: unknown) => {
    // Validate input
    const parsed = qrCodeToolSchema.safeParse(args);
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
      const { text, size = 300, errorCorrectionLevel = "M" } = input;

      // Validate input
      if (!text || text.trim().length === 0) {
        throw new Error("กรุณาระบุข้อความหรือ URL");
      }

      if (text.length > 4000) {
        throw new Error("ข้อความยาวเกินไป (สูงสุด 4000 ตัวอักษร)");
      }

      // Validate size
      const validSize = Math.min(Math.max(size, 100), 1000);

      // Generate QR code as base64 PNG
      const qrCodeDataUrl = await QRCode.toDataURL(text, {
        width: validSize,
        margin: 2,
        errorCorrectionLevel: errorCorrectionLevel,
        type: "image/png",
        color: {
          dark: "#000000",  // QR code color
          light: "#FFFFFF"  // Background color
        }
      });

      const result = {
        text,
        qrCodeImage: qrCodeDataUrl,
        size: validSize,
        errorCorrectionLevel,
        format: "PNG (Base64)",
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
      const errorMessage = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการสร้าง QR Code";
      console.error(`[QR Code Tool] Error: ${errorMessage}`);
      
      const errorResult = {
        text: input.text,
        qrCodeImage: "",
        size: input.size || 300,
        errorCorrectionLevel: input.errorCorrectionLevel || "M",
        format: "PNG (Base64)",
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

export default qrCodeTool;
