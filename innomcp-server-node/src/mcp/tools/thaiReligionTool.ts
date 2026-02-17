import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ThaiReligionToolInputSchema, ReligionType, TempleDenomination } from "../knowledge/types/religion";

/**
 * Mock Knowledge Base for Thai Religion (Round C - MVP)
 */
const RELIGION_KNOWLEDGE_BASE = [
    {
        id: "temple_emerald_buddha",
        name: "วัดพระศรีรัตนศาสดาราม",
        alt_names: ["วัดพระแก้ว", "Wat Phra Kaew"],
        type: ReligionType.TEMPLE,
        description: "วัดคู่บ้านคู่เมืองของประเทศไทย ภายในประดิษฐานพระแก้วมรกต",
        attributes: {
            denomination: TempleDenomination.MAHANIKAYA,
            location: {
                lat: 13.751,
                lon: 100.492,
                province: "กรุงเทพมหานคร"
            },
            importance: ["Royal Temple", "Historical Site"]
        }
    },
    {
        id: "temple_wat_pho",
        name: "วัดพระเชตุพนวิมลมังคลารามราชวรมหาวิหาร",
        alt_names: ["วัดโพธิ์", "Wat Pho"],
        type: ReligionType.TEMPLE,
        description: "วัดประจำรัชกาลที่ 1 และเป็นต้นกำเนิดการนวดแผนไทย มีพระนอนขนาดใหญ่",
        attributes: {
            denomination: TempleDenomination.MAHANIKAYA,
            location: {
                lat: 13.746,
                lon: 100.493,
                province: "กรุงเทพมหานคร"
            },
             importance: ["Royal Temple", "UNESCO Memory of the World"]
        }
    },
    {
         id: "temple_wat_arun",
         name: "วัดอรุณราชวรารามราชวรมหาวิหาร",
         alt_names: ["วัดแจ้ง", "Wat Arun"],
         type: ReligionType.TEMPLE,
         description: "วัดที่มีพระปรางค์สูงเด่นริมแม่น้ำเจ้าพระยา สัญลักษณ์ความรุ่งอรุณ",
         attributes: {
            denomination: TempleDenomination.MAHANIKAYA,
            location: {
                lat: 13.743,
                lon: 100.489,
                province: "กรุงเทพมหานคร"
            },
            importance: ["Royal Temple"]
        }
    },
    {
         id: "concept_visakha",
         name: "วันวิสาขบูชา",
         alt_names: ["Visakha Bucha Day"],
         type: ReligionType.TRADITION,
         description: "วันสำคัญทางพุทธศาสนาสากล รำลึกถึงการประสูติ ตรัสรู้ และปรินิพพานของพระพุทธเจ้า ตรงกับวันเพ็ญเดือน 6",
         attributes: {
             date_celebrated: "Full Moon of 6th Lunar Month"
         }
    }
];

export const thaiReligionTool = {
    name: "thai_religion_tool",
    description: "Information about Thai Buddhism, Temples, Monks, and Traditions.",
    inputSchema: ThaiReligionToolInputSchema,
    execute: async (args: z.infer<typeof ThaiReligionToolInputSchema>) => {
        const query = args.query.toLowerCase();
        const results: any[] = [];

        for (const item of RELIGION_KNOWLEDGE_BASE) {
             // Filter by Type (Map string input to Enum or just compare as string if compatible)
             // Schema defines specific strings, Item uses Enum. 
             // Logic: If arg provided, check if item.type string matches uppercase arg? 
             // Actually input types are "place" | "person" ...
             // Internal types are TEMPLE | MONK ...
             // We need a mapping.
             if (args.type) {
                 const typeMap: Record<string, ReligionType> = {
                     "place": ReligionType.TEMPLE,
                     "person": ReligionType.MONK,
                     "concept": ReligionType.TRADITION,
                     "calendar": ReligionType.TRADITION
                 };
                 if (item.type !== typeMap[args.type]) continue;
             }
             
             // Filter by Province (for Temples)
             if (args.province && item.attributes?.location?.province !== args.province) continue;

             // Match Name or Alt Names
             const matchName = item.name.includes(query) || item.alt_names?.some(n => n.toLowerCase().includes(query));
             const matchDesc = item.description.includes(query);

             if (matchName || matchDesc) {
                 results.push(item);
             }
        }

        if (results.length === 0) {
             return {
                content: [{
                    type: "text" as const,
                    text: `ไม่พบข้อมูลทางศาสนาหรือวัฒนธรรมที่ตรงกับ "${args.query}"`
                }]
            };
        }

        // Format Output
        const formattedText = results.map(item => {
            let info = `## ${item.name}`;
            if (item.alt_names) info += ` (${item.alt_names.join(", ")})`;
            info += `\n${item.description}`;
            
            if (item.attributes?.location) {
                info += `\n📍 ที่ตั้ง: ${item.attributes.location.province}`;
            }
            if (item.attributes?.importance) {
                info += `\n⭐ ความสำคัญ: ${item.attributes.importance.join(", ")}`;
            }
            return info;
        }).join("\n\n");

        return {
             content: [{
                 type: "text" as const,
                 text: formattedText
            }]
        };
    }
};

export function registerThaiReligionTool(server: McpServer) {
    server.registerTool(
        thaiReligionTool.name,
        {
             title: "Thai Religion & Culture",
             description: thaiReligionTool.description,
             inputSchema: thaiReligionTool.inputSchema
        },
        thaiReligionTool.execute
    );
}
