import { MCPTool } from "../types";
import { thaiKnowledgeTool } from "../../../tools/thaiKnowledgeTool";

export const THAI_KNOWLEDGE_LOCAL_TOOL_NAME = "thaiKnowledgeTool";

export const THAI_KNOWLEDGE_LOCAL_TOOL_DEF: MCPTool = {
  name: THAI_KNOWLEDGE_LOCAL_TOOL_NAME,
  description: "Thai Knowledge lookup for provinces and Thai domain knowledge.",
  category: "thai_knowledge",
  keywords: ["ประเทศไทย", "จังหวัด", "อำเภอ", "ตำบล", "ภูมิศาสตร์", "thai", "thailand", "province", "knowledge"],
  examples: [
    "จังหวัดนครราชสีมาอยู่ภาคอะไร",
    "ประเทศไทยมีกี่จังหวัด",
    "ข้อมูลจังหวัดเชียงใหม่",
  ],
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      context: {
        type: "object",
        properties: {
          domain: { type: "string" },
          confidence_required: { type: "number" },
        },
      },
      filter_region: { type: "string" },
      limit: { type: "number" },
    },
    required: ["query"],
  },
};

type LocalThaiKnowledgeInput = {
  query?: string;
  filter_region?: string;
  limit?: number;
  context?: {
    confidence_required?: number;
  };
};

export async function handleThaiKnowledgeTool(input: LocalThaiKnowledgeInput) {
  const query = String(input?.query || "").trim();
  const confidenceRequired = Number(input?.context?.confidence_required ?? 0.6);

  if (!query) {
    return {
      success: false,
      error_code: "INVALID_QUERY",
      message: "query ต้องไม่เป็นค่าว่าง",
    };
  }

  const result = await thaiKnowledgeTool({
    query,
    filter_region: input?.filter_region,
    limit: input?.limit,
  });

  if (!result.success || result.data.length === 0) {
    return {
      success: false,
      error_code: "NOT_FOUND",
      message: `ไม่พบข้อมูลสำหรับ '${query}'`,
      note: result.note,
    };
  }

  if (result.confidence < confidenceRequired) {
    return {
      success: false,
      error_code: "LOW_CONFIDENCE",
      message: `ผลลัพธ์มี confidence ${result.confidence.toFixed(2)} ต่ำกว่าที่กำหนด ${confidenceRequired.toFixed(2)}`,
      note: "ปฏิเสธผลลัพธ์เพื่อป้องกันการเดา",
    };
  }

  return {
    success: true,
    domain: "geo",
    data: result.data,
    confidence: result.confidence,
    source: [{ name: result.source }],
    note: result.note,
  };
}
