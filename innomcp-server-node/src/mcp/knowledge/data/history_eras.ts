import type { EraEntity } from "../types/history";
import type { ThaiKnowledgeSource } from "../../tools/thaiKnowledge.types";

const now = new Date().toISOString();
const RTGG_SOURCE: ThaiKnowledgeSource = { name: "Royal Thai Government Gazette" };

export const HISTORY_ERAS: EraEntity[] = [
  {
    id: "history:sukhothai",
    domain: "history",
    name_th: "อาณาจักรสุโขทัย",
    aliases: ["สุโขทัย", "กรุงสุโขทัย"],
    description:
      "อาณาจักรไทยแห่งแรก ก่อตั้ง พ.ศ. 1792 โดยพ่อขุนศรีอินทราทิตย์ เมืองหลวงอยู่ที่สุโขทัย",
    attributes: {
      entity_type: "era",
      capital: "สุโขทัย",
      year_start: 1249,
      year_end: 1438,
      period: "พ.ศ. 1792–1981",
      key_figures: ["พ่อขุนศรีอินทราทิตย์", "พ่อขุนรามคำแหง"],
      successor_era: "history:ayutthaya",
    },
    relations: [{ type: "succeeded_by", target_id: "history:ayutthaya" }],
    source: RTGG_SOURCE,
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
  {
    id: "history:ayutthaya",
    domain: "history",
    name_th: "อาณาจักรอยุธยา",
    aliases: ["อยุธยา", "กรุงศรีอยุธยา"],
    description:
      "อาณาจักรไทยที่ยิ่งใหญ่ ก่อตั้ง พ.ศ. 1893 โดยสมเด็จพระรามาธิบดีที่ 1 (พระเจ้าอู่ทอง)",
    attributes: {
      entity_type: "era",
      capital: "กรุงศรีอยุธยา",
      year_start: 1350,
      year_end: 1767,
      period: "พ.ศ. 1893–2310",
      key_figures: ["สมเด็จพระรามาธิบดีที่ 1", "สมเด็จพระนเรศวรมหาราช"],
      predecessor_era: "history:sukhothai",
      successor_era: "history:thonburi",
    },
    relations: [
      { type: "preceded_by", target_id: "history:sukhothai" },
      { type: "succeeded_by", target_id: "history:thonburi" },
    ],
    source: RTGG_SOURCE,
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
  {
    id: "history:thonburi",
    domain: "history",
    name_th: "อาณาจักรธนบุรี",
    aliases: ["ธนบุรี", "กรุงธนบุรี"],
    description:
      "อาณาจักรสั้นหลังเสียกรุงศรีอยุธยา ก่อตั้งโดยสมเด็จพระเจ้าตากสินมหาราช",
    attributes: {
      entity_type: "era",
      capital: "กรุงธนบุรี",
      year_start: 1767,
      year_end: 1782,
      period: "พ.ศ. 2310–2325",
      key_figures: ["สมเด็จพระเจ้าตากสินมหาราช"],
      predecessor_era: "history:ayutthaya",
      successor_era: "history:rattanakosin",
    },
    relations: [
      { type: "preceded_by", target_id: "history:ayutthaya" },
      { type: "succeeded_by", target_id: "history:rattanakosin" },
    ],
    source: RTGG_SOURCE,
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
  {
    id: "history:rattanakosin",
    domain: "history",
    name_th: "กรุงรัตนโกสินทร์",
    aliases: ["รัตนโกสินทร์", "ราชวงศ์จักรี"],
    description:
      "ยุคปัจจุบัน ก่อตั้งโดยพระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลกมหาราช (รัชกาลที่ 1)",
    attributes: {
      entity_type: "era",
      capital: "กรุงเทพมหานคร",
      year_start: 1782,
      period: "พ.ศ. 2325–ปัจจุบัน",
      key_figures: ["พระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลกมหาราช"],
      predecessor_era: "history:thonburi",
    },
    relations: [{ type: "preceded_by", target_id: "history:thonburi" }],
    source: RTGG_SOURCE,
    confidence: 0.95,
    version: "1.0.0",
    updated_at: now,
  },
];
