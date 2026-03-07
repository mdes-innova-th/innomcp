import { withDbConnection } from "../utils/db";
import { ThaiKnowledgeEntity } from "../types/thaiKnowledge";
import { RowDataPacket } from "mysql2/promise";

/**
 * Thai Geo Tool (MCP Tool Interface Compliant)
 */
export const thaiGeoTool = {
  name: "thai_geo_tool",
  description: "ค้นหาข้อมูลภูมิศาสตร์ไทย (จังหวัด, อำเภอ, ตำบล) พิกัด และภูมิภาค เพื่อสนับสนุนบริบทให้กับ AI",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      context: {
        type: "object",
        properties: {
          domain: { type: "string" },
          language: { type: "string" },
          confidence_required: { type: "number" }
        }
      },
      filter_region: { type: "string" }
    },
    required: ["query"]
  },
  
  execute: async (args: any) => {
    try {
      const q = String(args.query || "").trim();
      if (!q) {
        return {
          success: false,
          domain: "geo",
          data: [],
          confidence: 0,
          source: [],
          note: "Empty query"
        };
      }

      return await withDbConnection(async (conn) => {
        const likeQuery = `%${q}%`;
        const [rows] = await conn.execute<RowDataPacket[]>(
          `SELECT * FROM knowledge_entities 
           WHERE domain = 'geo' AND (name_th LIKE ? OR aliases LIKE ?)`,
          [likeQuery, likeQuery]
        );

        if (rows.length === 0) {
          return {
            success: true,
            domain: "geo",
            data: [],
            confidence: 0,
            source: [],
            note: "ไม่พบข้อมูลในระบบ"
          };
        }

        // Parse attributes and source
        const data = rows.map(r => ({
          id: r.id,
          name: r.name_th,
          type: r.type,
          attributes: typeof r.attributes === 'string' ? JSON.parse(r.attributes) : (r.attributes || {}),
          confidence: parseFloat(r.confidence)
        }));

        let maxConfidence = 0;
        data.forEach(d => { if (d.confidence > maxConfidence) maxConfidence = d.confidence; });

        let combinedSources: any[] = [];
        try {
          if (rows[0].source) {
             const parsed = typeof rows[0].source === 'string' ? JSON.parse(rows[0].source) : rows[0].source;
             if (Array.isArray(parsed)) combinedSources = parsed;
          }
        } catch(e) {}

        const confThreshold = args.context?.confidence_required || 0.6;
        let note = "พบข้อมูลตรงกับคำค้นหา";
        if (maxConfidence < confThreshold) {
           note = "ความน่าเชื่อถือรอบแรกต่ำกว่าที่กำหนด";
        }

        return {
          success: true,
          domain: "geo",
          data,
          confidence: maxConfidence,
          source: combinedSources,
          note
        };
      });
    } catch (e: any) {
      console.error("[thaiGeoTool] Error:", e);
      return {
        success: false,
        domain: "geo",
        data: [],
        confidence: 0,
        source: [],
        note: `Database Error: ${e.message}`
      };
    }
  }
};
