import Fuse from "fuse.js";

export type Item = Record<string, any>;

const defaultOptions = {
  // กำหนด keys ที่ต้องการ search เช่น title, content, tags
  keys: [
    { name: "title", weight: 0.7 },
    { name: "content", weight: 0.3 },
    { name: "tags", weight: 0.5 },
  ],
  includeMatches: true,
  includeScore: true,
  useExtendedSearch: true,
  threshold: 0.35,
  distance: 100,
  minMatchCharLength: 2,
} as any;

/**
 * สร้าง Fuse instance จากรายการข้อมูล
 */
export function makeFuse(list: Item[], options: any = {}) {
  const opt = { ...defaultOptions, ...options };
  console.log("[fuseSearch] Creating Fuse instance with options:", opt);
  return new Fuse(list, opt);
}

/**
 * รันการค้นหา โดยรับเป็น string หรือ extended-search object
 */
export function runSearch(fuse: Fuse<Item>, searchQuery: any) {
  console.log("[fuseSearch] Running search with query:", searchQuery);
  return fuse.search(searchQuery);
}

/**
 * แปลงผลจาก includeMatches ให้ได้ช่วงของคำสำหรับ highlight
 */
export function extractHighlights(result: any) {
  const highlights: Record<
    string,
    Array<{ text: string; indices: [number, number] }>
  > = {};
  if (!result.matches) return highlights;
  for (const m of result.matches) {
    const key = m.key;
    if (!highlights[key]) highlights[key] = [];
    const val = (m.value ?? "") as string;
    if (typeof val !== "string") continue;
    for (const idx of m.indices) {
      const [start, end] = idx;
      const text = val.slice(start, end + 1);
      highlights[key].push({ text, indices: [start, end] });
    }
  }
  console.log("[fuseSearch] Extracted highlights:", highlights);
  return highlights;
}

/**
 * ช่วยสร้าง extended search object แบบ AND จาก array ของคำ
 * ตัวอย่าง: buildAnd(['apple','pro']) => { $and: ['apple','pro'] }
 */
export function buildAnd(terms: string[]) {
  console.log("[fuseSearch] Building AND search object with terms:", terms);
  return { $and: terms };
}

/**
 * ช่วยสร้าง extended search object แบบ OR
 */
export function buildOr(terms: string[]) {
  console.log("[fuseSearch] Building OR search object with terms:", terms);
  return { $or: terms };
}

/**
 * ตัวอย่าง extended operators (อธิบายในคอมเมนต์):
 * '^term' - prefix
 * 'term$' - suffix
 * '=term' - exact
 * '!term' - negation
 */

export default {
  makeFuse,
  runSearch,
  extractHighlights,
  buildAnd,
  buildOr,
};
