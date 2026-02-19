/**
 * Thai Law Domain Types
 */
import { z } from "zod";

// Domain Enum Extension (Logical, will be used in main union)
export const LawDomain = z.literal("LAW");

// Entity Types
export enum LawType {
    ACT = "ACT",       // พระราชบัญญัติ
    CODE = "CODE",     // ประมวลกฎหมาย
    DECREE = "DECREE", // พรก. / กฎกระทรวง
    CONSTITUTION = "CONSTITUTION" // รัฐธรรมนูญ
}

export enum LawStatus {
    ACTIVE = "ACTIVE",
    REVOKED = "REVOKED",
    DRAFT = "DRAFT"
}

// Section Structure
export interface LawSection {
    no: string;          // "112", "14(1)"
    title?: string;      // "หมิ่นประมาทพระมหากษัตริย์"
    content: string;     // Full text
    keywords?: string[];
}

// Main Entity
export const ThaiLawEntitySchema = z.object({
    id: z.string(),
    domain: LawDomain,
    type: z.nativeEnum(LawType),
    name: z.string(),   // "พระราชบัญญัติว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์"
    short_name: z.string().optional(), // "พ.ร.บ. คอมฯ"
    status: z.nativeEnum(LawStatus),
    published_date: z.string().optional(), // YYYY-MM-DD
    sections: z.array(z.custom<LawSection>()).optional(),
    source_uri: z.string().optional(), // Link to Royal Gazette
    last_updated: z.string()
});

export type ThaiLawEntity = z.infer<typeof ThaiLawEntitySchema>;

// Tool Input/Output (Contract)
export const ThaiLawToolInputSchema = z.object({
    query: z.string(),
    type: z.enum(["search", "section_lookup", "summary"]).default("search"),
    law_name_filter: z.string().optional(),
    section_no: z.string().optional()
});

export type ThaiLawToolInput = z.infer<typeof ThaiLawToolInputSchema>;
