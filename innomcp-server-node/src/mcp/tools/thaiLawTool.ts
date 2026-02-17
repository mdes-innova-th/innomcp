import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ThaiLawToolInputSchema, LawType, LawStatus } from "../knowledge/types/law";

/**
 * Mock Knowledge Base for Thai Laws (Round C - MVP)
 * To be replaced with full vector DB later
 */
const LAW_KNOWLEDGE_BASE = [
    {
        id: "law_cca_2560",
        name: "พระราชบัญญัติว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์ (ฉบับที่ 2) พ.ศ. 2560",
        short_name: "พ.ร.บ. คอมฯ",
        type: LawType.ACT,
        status: LawStatus.ACTIVE,
        sections: [
            {
                no: "14",
                title: "การนำเข้าข้อมูลเท็จ/บิดเบือน",
                content: "ผู้ใดกระทำความผิดที่ระบุไว้ดังต่อไปนี้ ต้องระวางโทษจำคุกไม่เกิน 5 ปี หรือปรับไม่เกิน 1 แสนบาท หรือทั้งจำทั้งปรับ...(1) นำเข้าสู่ระบบคอมพิวเตอร์ซึ่งข้อมูลคอมพิวเตอร์ที่บิดเบือน หรือปลอมไม่ว่าทั้งหมดหรือบางส่วน หรือข้อมูลคอมพิวเตอร์อันเป็นเท็จ โดยประการที่น่าจะเกิดความเสียหายแก่ประชาชน..."
            },
            {
                no: "16",
                title: "การตัดต่อภาพผู้อื่น",
                content: "ผู้ใดนำเข้าสู่ระบบคอมพิวเตอร์ที่ประชาชนทั่วไปอาจเข้าถึงได้ ซึ่งข้อมูลคอมพิวเตอร์ที่ปรากฏเป็นภาพของผู้อื่น และภาพนั้นเป็นภาพที่เกิดจากการสร้างขึ้น ตัดต่อ เติม หรือดัดแปลงด้วยวิธีการทางอิเล็กทรอนิกส์หรือวิธีการอื่นใด ทั้งนี้ โดยประการที่น่าจะทำให้ผู้อื่นนั้นเสียชื่อเสียง ถูกดูหมิ่น ถูกเกลียดชัง หรือได้รับความอับอาย..."
            }
        ]
    },
    {
        id: "law_criminal_code",
        name: "ประมวลกฎหมายอาญา",
        short_name: "ป.อาญา",
        type: LawType.CODE,
        status: LawStatus.ACTIVE,
        sections: [
             {
                no: "112",
                title: "ความผิดต่อองค์พระมหากษัตริย์",
                content: "ผู้ใดหมิ่นประมาท ดูหมิ่น หรือแสดงความอาฆาตมาดร้ายพระมหากษัตริย์ พระราชินี รัชทายาท หรือผู้สำเร็จราชการแทนพระองค์ ต้องระวางโทษจำคุกตั้งแต่ 3 ปีถึง 15 ปี"
            },
            {
                no: "288",
                title: "ความผิดฐานฆ่าผู้อื่น",
                content: "ผู้ใดฆ่าผู้อื่น ต้องระวางโทษประหารชีวิต จำคุกตลอดชีวิต หรือจำคุกตั้งแต่ 15 ปีถึง 20 ปี"
            },
            {
                no: "334",
                title: "ความผิดฐานลักทรัพย์",
                content: "ผู้ใดเอาทรัพย์ของผู้อื่น หรือที่ผู้อื่นเป็นเจ้าของรวมอยู่ด้วยไปโดยทุจริต ผู้นั้นกระทำความผิดฐานลักทรัพย์ ต้องระวางโทษจำคุกไม่เกิน 3 ปี และปรับไม่เกิน 60,000 บาท"
            }
        ]
    }
];

export const THAI_LAW_SEED = LAW_KNOWLEDGE_BASE.map((law) => {
    const aliases = [law.short_name].filter((x): x is string => !!x && x.trim().length > 0);
    const sections = Array.isArray(law.sections) ? law.sections : [];
    const descPieces: string[] = [];
    descPieces.push(law.short_name ? `${law.short_name}` : law.name);
    if (sections.length > 0) descPieces.push(`มีมาตราตัวอย่าง ${sections.length} มาตรา`);

    return {
        id: law.id,
        domain: "law",
        name_th: law.name,
        aliases,
        description: descPieces.join(" - "),
        attributes: {
            entity_type: "law",
            law_type: law.type,
            status: law.status,
            sections: sections.map((s) => ({
                no: s.no,
                title: s.title,
            })),
        },
        relations: [],
        source: { name: "in-memory" },
        confidence: 1.0,
        version: "1.0.0",
    };
});

export const thaiLawTool = {
    name: "thai_law_tool",
    description: "Access Thai legal information (Royal Gazette, Acts, Codes). Use for Section lookup (มาตรา) or searching laws.",
    inputSchema: ThaiLawToolInputSchema,
    execute: async (args: Omit<z.infer<typeof ThaiLawToolInputSchema>, "type"> & { type?: "search" | "section_lookup" | "summary" }) => {
        const query = args.query.toLowerCase();
        const type = args.type || "search";
        
        let results: typeof LAW_KNOWLEDGE_BASE[0]["sections"] = [];
        let metadata_info = "";

        // 1. Specific Section Lookup
        if (type === "section_lookup" || (args.section_no && args.section_no.length > 0)) {
            const sectionNo = args.section_no || query.match(/\d+/)?.[0];
            
            if (sectionNo) {
                 for (const law of LAW_KNOWLEDGE_BASE) {
                    // Filter by law name if provided
                    if (args.law_name_filter && !law.name.includes(args.law_name_filter) && !law.short_name?.includes(args.law_name_filter)) {
                        continue;
                    }

                    const found = law.sections?.find(s => s.no === sectionNo);
                    if (found) {
                        results.push({
                            ...found, 
                            title: `${law.short_name || law.name} มาตรา ${found.no} - ${found.title}` // Enfich title
                        });
                    }
                 }
            }
        } 
        // 2. Keyword Search
        else {
            for (const law of LAW_KNOWLEDGE_BASE) {
                 // Match Law Name
                 if (law.name.toLowerCase().includes(query) || law.short_name?.toLowerCase().includes(query)) {
                      metadata_info += `Found Law: ${law.name}\n`;
                      if (law.sections) results.push(...law.sections.map(s => ({...s, title: `${law.short_name} ม.${s.no} ${s.title}`})));
                 }
                 // Match Section Content
                 else if (law.sections) {
                     const matchedSections = law.sections.filter(s => 
                        s.content.toLowerCase().includes(query) || 
                        s.title?.toLowerCase().includes(query)
                     );
                     if (matchedSections.length > 0) {
                         results.push(...matchedSections.map(s => ({...s, title: `${law.short_name} ม.${s.no} ${s.title}`})));
                     }
                 }
            }
        }

        if (results.length === 0) {
            return {
                content: [{
                    type: "text" as const,
                    text: `ไม่พบข้อมูลกฎหมายที่ตรงกับคำค้นหา "${args.query}"`
                }]
            };
        }

        // Format Output
        const formattedText = results.map(s => `## ${s.title}\n"${s.content}"`).join("\n\n");

        return {
            content: [{
                 type: "text" as const,
                 text: formattedText
            }]
        };
    }
};

export function registerThaiLawTool(server: McpServer) {
    server.registerTool(
        thaiLawTool.name,
        {
            title: "Thai Law & Royal Gazette",
            description: thaiLawTool.description,
            inputSchema: thaiLawTool.inputSchema
        },
        thaiLawTool.execute
    );
}
