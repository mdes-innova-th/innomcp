
import { resolveProvinces } from "./src/utils/locationResolver";

const query = "รังสิตฝนตกไหม  ที่ไหนฝนตกบ้างในประเทศไทยวันนี้ และสัปดาห์นี้ จงแสดงในรูปแบบตาราง";

console.log("Testing Query:", query);
const provinces = resolveProvinces(query);
console.log("Resolved Provinces:", provinces);

// Check if "Thailand" or National intent is detected
// (Note: resolvedProvinces only returns provinces, so if it returns [], it might be National)
// But here we expect ['ปทุมธานี'] because of "รังสิต"

process.exit(0);
