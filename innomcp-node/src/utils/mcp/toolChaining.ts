/**
 * Tool Chaining Logic
 * Handles planning and execution of chained tool calls
 */


import {
  ToolChainStep,
  ToolChainPlan,
  ChainExecutionResult,
  MCPTool,
} from "./types";
import { logBoth } from "../mcpLogger";

export class ToolChainingEngine {
  /**
   * วิเคราะห์ว่าคำถามต้องใช้ tool chaining หรือไม่
   * และวางแผนลำดับการใช้ tools
   */
  static async planToolChain(
    userMessage: string,
    selectedTools: string[],
    tools: Map<string, MCPTool>,
    chatWithOllama: (messages: any[], options?: any) => Promise<any>,
    extractJsonFromText: (text: string) => string | null
  ): Promise<ToolChainPlan | null> {
    logBoth("info", "===== Starting planToolChain =====");

    // ถ้ามี tool เดียวไม่ต้อง chain
    if (selectedTools.length <= 1) {
      logBoth("info", "[Chain] Only 1 tool, no chaining needed");
      return null;
    }

    try {
      // สร้าง descriptions ของ tools ที่เลือก
      const toolDescriptions = selectedTools
        .map((toolName) => {
          const tool = tools.get(toolName);

          const description = tool?.description || "ไม่มีคำอธิบาย";
          const category = tool?.category || "general";
          const examples = tool?.examples?.slice(0, 2).join(", ") || "ไม่มี";

          return `${toolName}:
  - หมวดหมู่: ${category}
  - คำอธิบาย: ${description}
  - ตัวอย่าง: ${examples}`;
        })
        .join("\n\n");

      const prompt = `วิเคราะห์คำถามและวางแผนการใช้ tools ตามลำดับ

คำถาม: "${userMessage}"

Tools ที่มี:
${toolDescriptions}

วิเคราะห์ว่า:
1. ต้องใช้ tools ตามลำดับหรือไม่? (tool chaining)
2. tool ใดต้องรอผลจาก tool ใดก่อน?
3. วัตถุประสงค์ของแต่ละ step คือะไร?

ตัวอย่างที่ต้อง chain:
- "หาข้อมูลเว็บไซต์ผิดกฎหมายแล้วสร้างกราฟ" → ต้อง chain (ดึงข้อมูล → สร้างกราฟ)
- "ดูอากาศวันนี้แล้วแนะนำกิจกรรม" → ต้อง chain (ดูอากาศ → แนะนำ)

ตัวอย่างที่ไม่ต้อง chain:
- "วันนี้วันที่เท่าไหร่" → ไม่ต้อง chain (ใช้ tool เดียว)
- "สวัสดี" → ไม่ต้อง chain

ตอบเป็น JSON เท่านั้น:
{
  "isChainable": true/false,
  "reasoning": "เหตุผลที่ต้อง/ไม่ต้อง chain",
  "steps": [
    {
      "toolName": "ชื่อ tool เต็ม",
      "description": "สิ่งที่ tool นี้จะทำ",
      "dependsOn": [0, 1]  // optional: array ของ step index ที่ต้องรอ (เริ่มจาก 0)
    }
  ]
}

หมายเหตุ:
- dependsOn: ถ้า step นี้ต้องรอผลจาก step อื่น ให้ระบุ index
- ถ้าไม่ต้อง chain ให้ตอบ isChainable: false และ steps: []

JSON:`;

      logBoth("info", "[Chain] Calling Ollama for chain planning...");
      const response = await chatWithOllama(
        [{ role: "user", content: prompt }],
        { temperature: 0.2, num_predict: 500 }
      );

      const rawText = String(response.message?.content || "").trim();
      logBoth("info", `[Chain] Ollama response: ${rawText.slice(0, 200)}...`);

      const jsonStr = extractJsonFromText(rawText);
      if (!jsonStr) {
        logBoth("warn", "[Chain] No JSON found in response");
        return null;
      }

      const plan: ToolChainPlan = JSON.parse(jsonStr);

      // Validate plan
      if (!plan.isChainable || !plan.steps || plan.steps.length === 0) {
        logBoth("info", "[Chain] Plan indicates no chaining needed");
        return null;
      }

      // Validate tool names in steps
      plan.steps = plan.steps.filter((step) => {
        const exists = selectedTools.includes(step.toolName);
        if (!exists) {
          logBoth("warn", `[Chain] Invalid tool in plan: ${step.toolName}`);
        }
        return exists;
      });

      if (plan.steps.length === 0) {
        logBoth("warn", "[Chain] No valid steps after validation");
        return null;
      }

      logBoth(
        "info",
        `[Chain] ✅ Created chain plan with ${plan.steps.length} steps`
      );
      logBoth("info", `[Chain] Reasoning: ${plan.reasoning}`);

      return plan;
    } catch (error) {
      logBoth("error", `[Chain] Error planning tool chain: ${error}`);
      return null;
    }
  }

  /**
   * สร้าง context จาก dependencies สำหรับการสร้าง args
   */
  static createDependencyContext(
    userMessage: string,
    step: ToolChainStep,
    dependencyResults: any[]
  ): string {
    let context = `คำถามเดิม: "${userMessage}"\n\n`;
    context += `ขั้นตอนปัจจุบัน: ${step.description}\n`;
    context += `Tool ที่จะใช้: ${step.toolName}\n\n`;
    context += `ผลลัพธ์จากขั้นตอนก่อนหน้า:\n`;

    dependencyResults.forEach((result, idx) => {
      if (!result) return;

      const resultStr =
        typeof result === "string" ? result : JSON.stringify(result, null, 2);

      context += `\n--- ผลจาก Step ${idx + 1} ---\n`;
      context += resultStr;
      context += `\n`;
    });

    context += `\nให้สร้าง parameters สำหรับ ${step.toolName} โดยใช้ข้อมูลจากผลลัพธ์ข้างต้น`;

    return context;
  }

  /**
   * สร้าง enhanced context จาก chain results
   */
  static createChainContext(
    userMessage: string,
    chainResults: ChainExecutionResult[]
  ): string {
    let context = `คำถามเดิม: "${userMessage}"\n\n`;
    context += `ผลลัพธ์จาก Tool Chain (${chainResults.length} steps):\n\n`;

    for (const result of chainResults) {
      const statusIcon = result.success ? "✅" : "❌";
      const timeStr = result.executionTime ? `(${result.executionTime}ms)` : "";

      context += `${statusIcon} Step ${result.step}: ${result.toolName} ${timeStr}\n`;
      context += `   วัตถุประสงค์: ${result.description}\n`;

      if (result.error) {
        context += `   ❌ Error: ${result.error}\n\n`;
      } else if (result.result) {
        const resultStr =
          typeof result.result === "string"
            ? result.result
            : JSON.stringify(result.result, null, 2);
        context += `   ผลลัพธ์:\n${resultStr}\n\n`;
      }
    }

    // เพิ่มคำแนะนำ
    const successCount = chainResults.filter((r) => r.success).length;
    const successRate = (successCount / chainResults.length) * 100;

    context += `\nสรุป: สำเร็จ ${successCount}/${
      chainResults.length
    } steps (${successRate.toFixed(0)}%)\n`;

    if (successRate === 100) {
      context += `💡 ข้อมูลครบถ้วน ใช้ผลจากทุก steps ในการตอบ\n`;
    } else if (successRate >= 50) {
      context += `⚠️ มีบาง steps ล้มเหลว ให้ใช้ข้อมูลที่มีในการตอบ\n`;
    } else {
      context += `❌ Tool chain ล้มเหลวส่วนใหญ่ ให้ตอบโดยไม่พึ่งพาข้อมูลมาก\n`;
    }

    return context;
  }
}
