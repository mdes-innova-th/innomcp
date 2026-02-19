/**
 * Thai Religion & Culture Domain Types
 */
import { z } from "zod";

// Domain Enum Extension
export const ReligionDomain = z.literal("RELIGION");

export enum ReligionType {
    TEMPLE = "TEMPLE",     // วัด
    MONK = "MONK",         // พระสงฆ์ / เกจิ
    TRADITION = "TRADITION", // ประเพณี / วันสำคัญ
    BELIEF = "BELIEF"      // ความเชื่อ / เครื่องราง
}

export enum TempleDenomination {
    MAHANIKAYA = "Mahanikaya",       // มหานิกาย
    DHAMMAYUTTIKA = "Dhammayuttika", // ธรรมยุติกนิกาย
    MAHAYANA = "Mahayana",           // มหายาน (วัดจีน/ญวน)
    OTHER = "Other"
}

// Location
export interface GeoLocation {
    lat: number;
    lon: number;
    province: string;
    district?: string;
}

// Main Entity
export const ThaiReligionEntitySchema = z.object({
    id: z.string(),
    domain: ReligionDomain,
    type: z.nativeEnum(ReligionType),
    name: z.string(),
    alt_names: z.array(z.string()).optional(),
    description: z.string(),
    
    // Type specific attributes
    attributes: z.object({
        denomination: z.nativeEnum(TempleDenomination).optional(),
        location: z.custom<GeoLocation>().optional(),
        abbot: z.string().optional(), // เจ้าอาวาส
        importance: z.array(z.string()).optional(), // "Royal Temple", "Historical Site"
        date_celebrated: z.string().optional() // For traditions (Lunar date logic handled elsewhere)
    }).optional(),

    source: z.string().optional()
});

export type ThaiReligionEntity = z.infer<typeof ThaiReligionEntitySchema>;

// Tool Contract
export const ThaiReligionToolInputSchema = z.object({
    query: z.string(),
    type: z.enum(["place", "person", "concept", "calendar"]).optional(),
    province: z.string().optional(),
    temple_rank: z.enum(["ROYAL", "COMMON"]).optional()
});

export type ThaiReligionToolInput = z.infer<typeof ThaiReligionToolInputSchema>;
