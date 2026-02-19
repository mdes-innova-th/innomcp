
import { executeQuery } from '../../db/connector';
import { MCPTool } from '../types';

export const THAI_GEO_TOOL_NAME = 'thai_geo_tool';

export const THAI_GEO_TOOL_DEF: MCPTool = {
  name: THAI_GEO_TOOL_NAME,
  description: 'Search for Thai geographical entities (provinces, districts) with region filtering. Returns name, coordinates, and region. Use this tool when users ask about provinces, map locations, or regions in Thailand.',
  category: 'geo',
  keywords: ['province', 'thailand', 'map', 'location', 'จังหวัด', 'อำเภอ', 'ภาค', 'พิกัด', 'แผนที่', 'ภูมิศาสตร์'],
  examples: [
    "ขอข้อมูลจังหวัดเชียงใหม่",
    "ค้นหาจังหวัดในภาคเหนือ",
    "พิกัดของภูเก็ตอยู่ที่ไหน"
  ],
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Name of province (Thai or English)' },
      filter_region: { type: 'string', description: 'Optional: Filter by region (ex: เหนือ, ใต้, กลาง)' },
      context: { type: 'object', description: 'Optional context' }
    },
    required: ['query']
  }
};

export interface ThaiGeoInput {
  query: string;
  filter_region?: string;
  context?: any;
}

export interface ThaiGeoResult {
  id: string;
  name: string;
  type: string;
  attributes: any;
  confidence: number;
}

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}

const REGION_MAPPING: Record<string, string> = {
  "north": "ภาคเหนือ",
  "south": "ภาคใต้",
  "central": "ภาคกลาง",
  "northeast": "ภาคตะวันออกเฉียงเหนือ",
  "isan": "ภาคตะวันออกเฉียงเหนือ",
  "east": "ภาคตะวันออก",
  "west": "ภาคตะวันตก"
};

export async function handleThaiGeoTool(args: any): Promise<any> {
    try {
      const { query, filter_region } = args;
      
      let sql = `
        SELECT * FROM knowledge_entities 
        WHERE (name_th LIKE ? OR JSON_CONTAINS(aliases, JSON_QUOTE(?)))
        AND domain = 'geo'
      `;

      const safeQuery = escapeLike(query);
      const params: any[] = [`%${safeQuery}%`, query];
      
      if (filter_region) {
        // 1. Resolve Region Name (English -> Thai)
        let targetRegion = filter_region;
        const lowerReg = filter_region.toLowerCase();
        if (REGION_MAPPING[lowerReg]) {
          targetRegion = REGION_MAPPING[lowerReg];
        }

        const regionCandidates = new Set<string>();
        regionCandidates.add(targetRegion);

        if (targetRegion.startsWith('ภาค')) {
          const withoutPrefix = targetRegion.replace(/^ภาค\s*/, '').trim();
          if (withoutPrefix) regionCandidates.add(withoutPrefix);
        } else {
          regionCandidates.add(`ภาค${targetRegion}`);
        }

        const regionClauses = Array.from(regionCandidates).map(
          () => `JSON_EXTRACT(attributes, '$.region') LIKE ?`
        );
        sql += ` AND (${regionClauses.join(' OR ')})`;

        for (const candidate of regionCandidates) {
          const safeRegion = escapeLike(candidate);
          params.push(`%${safeRegion}%`);
        }
      }
      
      sql += ` LIMIT 10`; 
      
      const rows = await executeQuery(sql, params) as any[];
      
      // 2. Graceful Error Handling
      if (rows.length === 0) {
        return {
          success: false,
          message: `ไม่พบข้อมูลสำหรับ '${query}' ${filter_region ? `ในเขต '${filter_region}'` : ''}`,
          suggestion: "ลองตรวจสอบชื่อจังหวัด หรือระบุภูมิลำเนาให้กว้างขึ้น"
        };
      }
      
      const results = rows.map(row => {
        let attrs: any = row.attributes;
        if (typeof attrs === 'string') {
          try {
            attrs = JSON.parse(attrs);
          } catch {
            attrs = {};
          }
        }
        attrs = attrs ?? {};
        return {
          provinces_id: row.id,     // 3. Strict Output: provinces_id
          name: row.name_th,
          lat: attrs.lat,           // 3. Strict Output: lat
          lon: attrs.lon,           // 3. Strict Output: lon
          region: attrs.region,
          confidence: row.confidence
        };
      });
      
      return {
        success: true,
        data: results, // Array of structured objects
        source: "MariaDB"
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: "internal query error"
      };
    }
}
