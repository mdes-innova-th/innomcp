import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mcpLog, logBoth } from "../../utils/mcpLogger";

const { create, all } = require("mathjs") as any;

type CalculatorInput = {
  expression: string;
};

// สร้าง mathjs instance ที่ optimize แล้ว
const math = create(all, {
  number: 'BigNumber',  // ใช้ BigNumber สำหรับตัวเลขใหญ่
  precision: 64,        // เพิ่ม precision
});

/**
 * Unit Conversion Helper
 * Converts between common units
 */
function convertUnit(value: number, fromUnit: string, toUnit: string): number {
  const conversions: Record<string, Record<string, number>> = {
    // Temperature (to Celsius first, then to target)
    "fahrenheit": { "celsius": (value - 32) * 5/9, "kelvin": (value - 32) * 5/9 + 273.15 },
    "celsius": { "fahrenheit": value * 9/5 + 32, "kelvin": value + 273.15 },
    "kelvin": { "celsius": value - 273.15, "fahrenheit": (value - 273.15) * 9/5 + 32 },
    
    // Length
    "meter": { "kilometer": value / 1000, "mile": value / 1609.34, "foot": value * 3.28084 },
    "kilometer": { "meter": value * 1000, "mile": value / 1.60934, "foot": value * 3280.84 },
    "mile": { "meter": value * 1609.34, "kilometer": value * 1.60934, "foot": value * 5280 },
    "foot": { "meter": value / 3.28084, "kilometer": value / 3280.84, "mile": value / 5280 },
    
    // Weight
    "kilogram": { "pound": value * 2.20462, "gram": value * 1000 },
    "pound": { "kilogram": value / 2.20462, "gram": value * 453.592 },
    "gram": { "kilogram": value / 1000, "pound": value / 453.592 },
  };
  
  const from = fromUnit.toLowerCase();
  const to = toUnit.toLowerCase();
  
  if (conversions[from] && conversions[from][to] !== undefined) {
    return conversions[from][to];
  }
  
  throw new Error(`Conversion from ${fromUnit} to ${toUnit} not supported`);
}

/**
 * แปลง product notation เช่น (3^3+1)(4^3+1)...(100^3+1) 
 * เป็น expression ที่ mathjs เข้าใจได้
 */
function expandProductNotation(expr: string): string {
  // Pattern: (n^3+1)(n+1^3+1)...(m^3+1)
  const productPattern = /\((\d+)\^3[+\-]\d+\)\((\d+)\^3[+\-]\d+\)\.+\((\d+)\^3[+\-]\d+\)/g;
  
  let expanded = expr;
  let match;
  
  while ((match = productPattern.exec(expr)) !== null) {
    const start = parseInt(match[1]);
    const end = parseInt(match[3]);
    const operation = match[0].includes('+') ? '+' : '-';
    const num = parseInt(match[0].match(/[+\-](\d+)/)?.[1] || '1');
    
    // สร้าง expression แบบ product
    const terms: string[] = [];
    for (let i = start; i <= end; i++) {
      terms.push(`(${i}^3${operation}${num})`);
    }
    
    expanded = expanded.replace(match[0], terms.join('*'));
  }
  
  return expanded;
}

export function registerCalculatorTool(mcpserver: McpServer) {
  mcpserver.registerTool(
    "calculatorTool",
    {
      title: "⚡ MathTool - Enhanced Calculator with Statistics & Unit Conversion",
      description: `
หน้าที่: คำนวณสูตรทางคณิตศาสตร์, สถิติ, และแปลงหน่วย (ULTRA FAST - ทันที ไม่ผ่าน AI)
ใช้เมื่อ:
- คำนวณตัวเลข (บวก, ลบ, คูณ, หาร, ยกกำลัง, รากที่)
- สถิติ: ค่าเฉลี่ย, มัธยฐาน, ส่วนเบี่ยงเบนมาตรฐาน, ความแปรปรวน
- แปลงหน่วย: อุณหภูมิ, ระยะทาง, น้ำหนัก
- มีคำว่า "คำนวณ", "หา", "เท่ากับเท่าไร", "ค่าเฉลี่ย", "แปลง", "convert"

ไม่ใช้เมื่อ:
- ต้องการคำอธิบายแนวคิด (ใช้ AI)
- คำถามที่ไม่เกี่ยวกับตัวเลข

พารามิเตอร์:
- expression: string (นิพจน์ทางคณิตศาสตร์, สถิติ, หรือการแปลงหน่วย)

รองรับฟังก์ชัน:
**พื้นฐาน**: +, -, *, /, ^, %
**คณิตศาสตร์**: sqrt(), abs(), round(), ceil(), floor()
**ตรีโกณ**: sin(), cos(), tan(), asin(), acos(), atan() (deg/rad)
**ลอการิทึม**: log(), log10(), ln()
**ค่าคงที่**: pi, e
**สถิติ (NEW!)**:
  - mean([1,2,3,4,5]) → ค่าเฉลี่ย
  - median([1,2,3,4,5]) → มัธยฐาน
  - std([1,2,3,4,5]) → ส่วนเบี่ยงเบนมาตรฐาน
  - variance([1,2,3,4,5]) → ความแปรปรวน
  - min([1,2,3,4,5]) → ค่าต่ำสุด
  - max([1,2,3,4,5]) → ค่าสูงสุด
  - sum([1,2,3,4,5]) → ผลรวม
**การแปลงหน่วย (NEW!)**: convert(value, from, to)
  Temperature: fahrenheit, celsius, kelvin
  Length: meter, kilometer, mile, foot
  Weight: kilogram, pound, gram

ตัวอย่างการใช้:
1. พื้นฐาน: {expression: "125 + 347"}
2. ค่าเฉลี่ย: {expression: "mean([2, 4, 6, 8])"}
3. ส่วนเบี่ยงเบนมาตรฐาน: {expression: "std([10, 20, 30, 40, 50])"}
4. แปลงอุณหภูมิ: {expression: "convert(100, 'fahrenheit', 'celsius')"}
5. แปลงระยะทาง: {expression: "convert(5, 'kilometer', 'mile')"}
6. แปลงน้ำหนัก: {expression: "convert(150, 'pound', 'kilogram')"}
7. ซับซ้อน: {expression: "mean([2,4,6]) * std([1,2,3])"}

⚡ **ULTRA FAST**: ตอบทันที ไม่ต้องรอ AI generation
🚀 **Much faster than AI** สำหรับคำถามคำนวณ

กฎ:
- MUST: expression ต้องเป็นนิพจน์ที่ถูกต้อง
- MUST: ใช้วงเล็บ () สำหรับลำดับการคำนวณ
- MUST: array ใช้ [1,2,3] สำหรับสถิติ
- ห้าม: ตัวแปรไม่รู้จัก (ต้องแทนค่าก่อน)
        `,
      // ⚠️ CRITICAL: ต้องมี inputSchema ไม่งั้น MCP SDK จะไม่ส่ง args parameter!
      inputSchema: z.object({
        expression: z.string().describe("นิพจน์ทางคณิตศาสตร์ที่ต้องการคำนวณ"),
      }) as any,
    },
      async (args: any) => {
      const input = args as CalculatorInput;
      const expression = input.expression;

      mcpLog('INFO', `[MathTool] Expression: ${expression.substring(0, 100)}${expression.length > 100 ? '...' : ''}`);

      try {
        // Clean up expression
        let cleanExpression = expression.trim();

        if (!cleanExpression) {
          throw new Error("Expression is empty");
        }
        
        // Check for unit conversion
        const convertMatch = cleanExpression.match(/convert\s*\(\s*([0-9.]+)\s*,\s*['"](\w+)['"]\s*,\s*['"](\w+)['"]\s*\)/i);
        if (convertMatch) {
          const value = parseFloat(convertMatch[1]);
          const fromUnit = convertMatch[2];
          const toUnit = convertMatch[3];
          
          mcpLog('INFO', `[MathTool] Unit conversion: ${value} ${fromUnit} → ${toUnit}`);
          
          const result = convertUnit(value, fromUnit, toUnit);
          const responseText = `แปลงหน่วย: ${value} ${fromUnit} = ${result.toFixed(4)} ${toUnit}`;
          
          return {
            content: [{ type: "text" as const, text: responseText }],
            structuredContent: {
              operation: "unit_conversion",
              value,
              fromUnit,
              toUnit,
              result: result.toFixed(4),
            },
          };
        }
        
        // Expand product notation ถ้ามี
        if (cleanExpression.includes('...')) {
          cleanExpression = expandProductNotation(cleanExpression);
        }
        
        // ใช้ * แทน implicit multiplication
        cleanExpression = cleanExpression
          .replace(/(\d)\(/g, '$1*(')  // 2(x) -> 2*(x)
          .replace(/\)(\d)/g, ')*$1')  // (x)2 -> (x)*2
          .replace(/\)\(/g, ')*(');    // )(  -> )*(

        const startTime = Date.now();
        
        // Evaluate using optimized mathjs
        const result = math.evaluate(cleanExpression);
        
        const computeTime = Date.now() - startTime;
        
        if (computeTime > 1000) {
          mcpLog('WARN', `[MathTool] Slow computation: ${computeTime}ms`);
        } else {
          mcpLog('INFO', `[MathTool] ⚡ Computed in ${computeTime}ms (instant!)`);
        }

        // Format result
        let formattedResult: number | string;
        if (typeof result === "number") {
          // Check if scientific notation needed
          if (Math.abs(result) > 1e15 || (Math.abs(result) < 1e-6 && result !== 0)) {
            formattedResult = result.toExponential(10);
          } else {
            formattedResult = Math.round(result * 10000000000) / 10000000000;
          }
        } else if (result && typeof result === "object" && 'toString' in result) {
          // BigNumber or complex numbers
          formattedResult = result.toString();
        } else if (typeof result === "object" && result !== null) {
          formattedResult = JSON.stringify(result);
        } else {
          formattedResult = String(result);
        }

        const responseText = `⚡ MathTool: ${cleanExpression}\nผลลัพธ์: ${formattedResult}\n(คำนวณใน ${computeTime}ms - เร็วกว่า AI!)`;

        return {
          content: [{ type: "text" as const, text: responseText }],
          structuredContent: {
            expression: cleanExpression,
            result: formattedResult,
            computeTime: `${computeTime}ms`,
          },
        };
      } catch (error) {

        const errorMessage = error instanceof Error ? error.message : String(error);
        logBoth('ERROR', `[MCP Server] MathTool error: ${String(error)}`);

        const errorText = `เกิดข้อผิดพลาดในการคำนวณ: ${errorMessage}\nนิพจน์: ${expression}`;

        return {
          content: [{ type: "text" as const, text: errorText }],
          structuredContent: {
            expression,
            result: "error",
            error: errorMessage,
          },
        };
      }
    }
  );
}
