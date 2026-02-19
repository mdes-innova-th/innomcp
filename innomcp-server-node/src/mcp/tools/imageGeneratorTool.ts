import { z } from "zod";
import { createCanvas } from "canvas";

/**
 * Image Generator Tool - สร้างรูปภาพด้วย Canvas
 * ฟรี 100% - ไม่ต้อง API key
 * รองรับ: shapes, text, charts, diagrams
 */

export const imageGeneratorToolSchema = z.object({
  type: z.enum(["shape", "text", "chart", "qr-styled"]).describe("ชนิดของรูปที่ต้องการสร้าง"),
  width: z.number().optional().default(800).describe("ความกว้างของรูป (pixels)"),
  height: z.number().optional().default(600).describe("ความสูงของรูป (pixels)"),
  backgroundColor: z.string().optional().default("#ffffff").describe("สีพื้นหลัง (hex color)"),
  content: z.object({
    // For shapes
    shapes: z.array(z.object({
      type: z.enum(["rectangle", "circle", "line", "triangle"]),
      x: z.number(),
      y: z.number(),
      width: z.number().optional(),
      height: z.number().optional(),
      radius: z.number().optional(),
      color: z.string().optional(),
      fill: z.boolean().optional(),
    })).optional(),
    
    // For text
    text: z.array(z.object({
      content: z.string(),
      x: z.number(),
      y: z.number(),
      font: z.string().optional(),
      color: z.string().optional(),
      size: z.number().optional(),
    })).optional(),
    
    // For simple charts
    chart: z.object({
      type: z.enum(["bar", "line", "pie"]),
      data: z.array(z.object({
        label: z.string(),
        value: z.number(),
        color: z.string().optional(),
      })),
      title: z.string().optional(),
    }).optional(),
  }).describe("เนื้อหาที่ต้องการวาด"),
});

export type ImageGeneratorInput = z.infer<typeof imageGeneratorToolSchema>;

export const imageGeneratorTool = {
  name: "imageGeneratorTool",
  description: `
หน้าที่: สร้างรูปภาพด้วย Canvas (รูปทรงเรขาคณิต, ข้อความ, charts พื้นฐาน)
ใช้เมื่อ:
- ต้องการสร้างรูปภาพง่ายๆ
- วาดรูปทรงเรขาคณิต (วงกลม, สี่เหลี่ม, เส้น)
- เขียนข้อความลงรูป
- สร้าง simple charts (bar, line, pie)
- สร้าง diagrams, infographics พื้นฐาน

คุณสมบัติ:
- ฟรี 100% (ไม่ต้อง API key)
- Offline capable
- Customizable (สี, ขนาด, ตำแหน่ง)
- Export เป็น PNG (base64)

รองรับรูปทรง:
- rectangle: สี่เหลี่ม
- circle: วงกลม
- line: เส้นตรง
- triangle: สามเหลี่ม

รองรับ Charts:
- bar: กราฟแท่ง
- line: กราฟเส้น
- pie: กราฟวงกลม

ตัวอย่าง:
- "สร้างรูปวงกลมสีแดง"
- "วาดสี่เหลี่มสีน้ำเงิน 200x100"
- "สร้างกราฟแท่งแสดงยอดขาย"
- "เขียนข้อความ 'Hello World' ลงรูป"
- "สร้าง diagram แสดงกระบวนการ"

หมายเหตุ:
- ไม่รองรับ AI image generation (DALL-E, Midjourney)
- เหมาะสำหรับรูปภาพพื้นฐาน, diagrams, charts
- สำหรับรูปซับซ้อน แนะนำใช้ AI image gen APIs (ไม่ฟรี)
`,
  inputSchema: imageGeneratorToolSchema,

  execute: async (args: unknown) => {
    // Validate input
    const parsed = imageGeneratorToolSchema.safeParse(args);
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
      const { type, width = 800, height = 600, backgroundColor = "#ffffff", content } = input;

      console.log(`[Image Generator] Creating ${type} image: ${width}x${height}`);

      // Create canvas
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");

      // Fill background
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);

      // Draw based on type
      switch (type) {
        case "shape":
          if (content.shapes) {
            drawShapes(ctx, content.shapes);
          }
          break;
        
        case "text":
          if (content.text) {
            drawText(ctx, content.text);
          }
          break;
        
        case "chart":
          if (content.chart) {
            drawChart(ctx, content.chart, width, height);
          }
          break;
      }

      // Add shapes and text if both provided
      if (content.shapes) drawShapes(ctx, content.shapes);
      if (content.text) drawText(ctx, content.text);

      // Convert to base64
      const imageBase64 = canvas.toDataURL("image/png");

      const result = {
        type,
        width,
        height,
        backgroundColor,
        image: imageBase64,
        format: "PNG (Base64)",
        success: true,
        timestamp: new Date().toISOString()
      };

      console.log(`[Image Generator] Success: Generated ${type} image`);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการสร้างรูปภาพ";
      console.error(`[Image Generator] Error: ${errorMessage}`);
      
      const errorResult = {
        type: input.type,
        width: input.width || 800,
        height: input.height || 600,
        image: "",
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

// Helper: Draw shapes
function drawShapes(ctx: any, shapes: any[]) {
  shapes.forEach((shape) => {
    ctx.fillStyle = shape.color || "#000000";
    ctx.strokeStyle = shape.color || "#000000";

    switch (shape.type) {
      case "rectangle":
        if (shape.fill !== false) {
          ctx.fillRect(shape.x, shape.y, shape.width || 100, shape.height || 100);
        } else {
          ctx.strokeRect(shape.x, shape.y, shape.width || 100, shape.height || 100);
        }
        break;
      
      case "circle":
        ctx.beginPath();
        ctx.arc(shape.x, shape.y, shape.radius || 50, 0, 2 * Math.PI);
        if (shape.fill !== false) {
          ctx.fill();
        } else {
          ctx.stroke();
        }
        break;
      
      case "line":
        ctx.beginPath();
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(shape.x + (shape.width || 100), shape.y + (shape.height || 0));
        ctx.stroke();
        break;
      
      case "triangle":
        ctx.beginPath();
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(shape.x + (shape.width || 100), shape.y);
        ctx.lineTo(shape.x + (shape.width || 100) / 2, shape.y - (shape.height || 100));
        ctx.closePath();
        if (shape.fill !== false) {
          ctx.fill();
        } else {
          ctx.stroke();
        }
        break;
    }
  });
}

// Helper: Draw text
function drawText(ctx: any, texts: any[]) {
  texts.forEach((text) => {
    ctx.fillStyle = text.color || "#000000";
    ctx.font = text.font || `${text.size || 24}px Arial`;
    ctx.fillText(text.content, text.x, text.y);
  });
}

// Helper: Draw simple chart
function drawChart(ctx: any, chart: any, width: number, height: number) {
  const padding = 60;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  
  // Draw title
  if (chart.title) {
    ctx.fillStyle = "#000000";
    ctx.font = "bold 24px Arial";
    ctx.fillText(chart.title, padding, padding / 2);
  }

  switch (chart.type) {
    case "bar":
      const barWidth = chartWidth / chart.data.length;
      const maxValue = Math.max(...chart.data.map((d: any) => d.value));
      
      chart.data.forEach((item: any, index: number) => {
        const barHeight = (item.value / maxValue) * chartHeight;
        const x = padding + index * barWidth;
        const y = padding + chartHeight - barHeight;
        
        ctx.fillStyle = item.color || "#3b82f6";
        ctx.fillRect(x + 10, y, barWidth - 20, barHeight);
        
        // Label
        ctx.fillStyle = "#000000";
        ctx.font = "12px Arial";
        ctx.fillText(item.label, x + barWidth / 2 - 20, padding + chartHeight + 20);
      });
      break;
    
    case "pie":
      let currentAngle = -Math.PI / 2;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(chartWidth, chartHeight) / 2 - 20;
      const total = chart.data.reduce((sum: number, item: any) => sum + item.value, 0);
      
      chart.data.forEach((item: any, index: number) => {
        const sliceAngle = (item.value / total) * 2 * Math.PI;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.lineTo(centerX, centerY);
        ctx.fillStyle = item.color || `hsl(${index * 360 / chart.data.length}, 70%, 50%)`;
        ctx.fill();
        
        currentAngle += sliceAngle;
      });
      break;
  }
}

export default imageGeneratorTool;
