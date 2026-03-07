import "dotenv/config";
import { query } from "../src/utils/db";

const shouldExec = process.argv.includes("--exec");

type ProvinceSeed = {
  name: string;
  region: string;
  lat: number;
  lon: number;
};

const PROVINCES: ProvinceSeed[] = [
  { name: "เชียงราย", region: "เหนือ", lat: 19.9105, lon: 99.8406 },
  { name: "เชียงใหม่", region: "เหนือ", lat: 18.7932, lon: 98.9853 },
  { name: "น่าน", region: "เหนือ", lat: 18.7832, lon: 100.7905 },
  { name: "พะเยา", region: "เหนือ", lat: 19.1662, lon: 99.9042 },
  { name: "แพร่", region: "เหนือ", lat: 18.1402, lon: 100.1477 },
  { name: "แม่ฮ่องสอน", region: "เหนือ", lat: 19.3021, lon: 97.9625 },
  { name: "ลำปาง", region: "เหนือ", lat: 18.2888, lon: 99.5009 },
  { name: "ลำพูน", region: "เหนือ", lat: 18.5772, lon: 99.008 },
  { name: "อุตรดิตถ์", region: "เหนือ", lat: 17.6192, lon: 100.0993 },
  { name: "กาฬสินธุ์", region: "อีสาน", lat: 16.4293, lon: 103.5065 },
  { name: "ขอนแก่น", region: "อีสาน", lat: 16.4326, lon: 102.8236 },
  { name: "ชัยภูมิ", region: "อีสาน", lat: 15.8001, lon: 102.0232 },
  { name: "นครพนม", region: "อีสาน", lat: 17.4085, lon: 104.7794 },
  { name: "นครราชสีมา", region: "อีสาน", lat: 14.9799, lon: 102.0977 },
  { name: "บึงกาฬ", region: "อีสาน", lat: 18.36, lon: 103.65 },
  { name: "บุรีรัมย์", region: "อีสาน", lat: 14.993, lon: 103.1029 },
  { name: "มหาสารคาม", region: "อีสาน", lat: 16.1865, lon: 103.3031 },
  { name: "มุกดาหาร", region: "อีสาน", lat: 16.5443, lon: 104.7081 },
  { name: "ยโสธร", region: "อีสาน", lat: 15.7924, lon: 104.1484 },
  { name: "ร้อยเอ็ด", region: "อีสาน", lat: 16.0538, lon: 103.652 },
  { name: "เลย", region: "อีสาน", lat: 17.486, lon: 101.7223 },
  { name: "สกลนคร", region: "อีสาน", lat: 17.1612, lon: 104.1473 },
  { name: "สุรินทร์", region: "อีสาน", lat: 14.8824, lon: 103.4936 },
  { name: "ศรีสะเกษ", region: "อีสาน", lat: 15.1118, lon: 104.3217 },
  { name: "หนองคาย", region: "อีสาน", lat: 17.8833, lon: 102.7333 },
  { name: "หนองบัวลำภู", region: "อีสาน", lat: 17.2029, lon: 102.4359 },
  { name: "อุดรธานี", region: "อีสาน", lat: 17.4123, lon: 102.7872 },
  { name: "อุบลราชธานี", region: "อีสาน", lat: 15.2448, lon: 104.8473 },
  { name: "อำนาจเจริญ", region: "อีสาน", lat: 15.8614, lon: 104.6231 },
  { name: "กรุงเทพมหานคร", region: "กลาง", lat: 13.7563, lon: 100.5018 },
  { name: "กำแพงเพชร", region: "กลาง", lat: 16.4843, lon: 99.5227 },
  { name: "ชัยนาท", region: "กลาง", lat: 15.195, lon: 100.1245 },
  { name: "นครนายก", region: "กลาง", lat: 14.2017, lon: 101.2133 },
  { name: "นครปฐม", region: "กลาง", lat: 13.814, lon: 100.0373 },
  { name: "นครสวรรค์", region: "กลาง", lat: 15.7001, lon: 100.0667 },
  { name: "นนทบุรี", region: "กลาง", lat: 13.8591, lon: 100.5217 },
  { name: "ปทุมธานี", region: "กลาง", lat: 14.0208, lon: 100.525 },
  { name: "พระนครศรีอยุธยา", region: "กลาง", lat: 14.3532, lon: 100.5689 },
  { name: "พิจิตร", region: "กลาง", lat: 16.4429, lon: 100.3503 },
  { name: "พิษณุโลก", region: "กลาง", lat: 16.8211, lon: 100.2659 },
  { name: "เพชรบูรณ์", region: "กลาง", lat: 16.419, lon: 101.1567 },
  { name: "ลพบุรี", region: "กลาง", lat: 14.7995, lon: 100.6533 },
  { name: "สมุทรปราการ", region: "กลาง", lat: 13.5991, lon: 100.5967 },
  { name: "สมุทรสงคราม", region: "กลาง", lat: 13.4098, lon: 100.0023 },
  { name: "สมุทรสาคร", region: "กลาง", lat: 13.5475, lon: 100.2736 },
  { name: "สิงห์บุรี", region: "กลาง", lat: 14.8878, lon: 100.4022 },
  { name: "สุโขทัย", region: "กลาง", lat: 17.0044, lon: 99.8264 },
  { name: "สุพรรณบุรี", region: "กลาง", lat: 14.4742, lon: 100.1177 },
  { name: "สระบุรี", region: "กลาง", lat: 14.5287, lon: 100.9108 },
  { name: "อ่างทอง", region: "กลาง", lat: 14.5896, lon: 100.455 },
  { name: "อุทัยธานี", region: "กลาง", lat: 15.3835, lon: 100.0246 },
  { name: "จันทบุรี", region: "ตะวันออก", lat: 12.61, lon: 102.1 },
  { name: "ฉะเชิงเทรา", region: "ตะวันออก", lat: 13.6904, lon: 101.0703 },
  { name: "ชลบุรี", region: "ตะวันออก", lat: 13.3611, lon: 100.9847 },
  { name: "ตราด", region: "ตะวันออก", lat: 12.2333, lon: 102.5167 },
  { name: "ปราจีนบุรี", region: "ตะวันออก", lat: 14.0509, lon: 101.3713 },
  { name: "ระยอง", region: "ตะวันออก", lat: 12.6828, lon: 101.2816 },
  { name: "สระแก้ว", region: "ตะวันออก", lat: 13.824, lon: 102.0645 },
  { name: "กาญจนบุรี", region: "ตะวันตก", lat: 14.0226, lon: 99.5323 },
  { name: "ตาก", region: "ตะวันตก", lat: 16.8837, lon: 99.1239 },
  { name: "ประจวบคีรีขันธ์", region: "ตะวันตก", lat: 11.8, lon: 99.7833 },
  { name: "เพชรบุรี", region: "ตะวันตก", lat: 13.1093, lon: 99.9395 },
  { name: "ราชบุรี", region: "ตะวันตก", lat: 13.5372, lon: 99.8164 },
  { name: "กระบี่", region: "ใต้", lat: 8.0855, lon: 98.9063 },
  { name: "ชุมพร", region: "ใต้", lat: 10.493, lon: 99.18 },
  { name: "ตรัง", region: "ใต้", lat: 7.5645, lon: 99.6239 },
  { name: "นครศรีธรรมราช", region: "ใต้", lat: 8.4116, lon: 99.9634 },
  { name: "นราธิวาส", region: "ใต้", lat: 6.4255, lon: 101.8253 },
  { name: "ปัตตานี", region: "ใต้", lat: 6.8675, lon: 101.15 },
  { name: "พังงา", region: "ใต้", lat: 8.4509, lon: 98.53 },
  { name: "พัทลุง", region: "ใต้", lat: 7.6167, lon: 100.0833 },
  { name: "ภูเก็ต", region: "ใต้", lat: 7.8804, lon: 98.3923 },
  { name: "ยะลา", region: "ใต้", lat: 6.5403, lon: 101.2804 },
  { name: "ระนอง", region: "ใต้", lat: 9.9658, lon: 98.6348 },
  { name: "สงขลา", region: "ใต้", lat: 7.1756, lon: 100.5967 },
  { name: "สตูล", region: "ใต้", lat: 6.6167, lon: 100.0667 },
  { name: "สุราษฎร์ธานี", region: "ใต้", lat: 9.1389, lon: 99.3333 },
];

const UPSERT_SQL =
  "INSERT INTO knowledge_entities " +
  "(id, domain, type, name_th, aliases, description, attributes, relations, source, confidence, version, updated_at) " +
  "VALUES (?, 'geo', 'province', ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
  "ON DUPLICATE KEY UPDATE " +
  "type=VALUES(type), aliases=VALUES(aliases), description=VALUES(description), attributes=VALUES(attributes), " +
  "relations=VALUES(relations), source=VALUES(source), confidence=VALUES(confidence), version=VALUES(version), updated_at=VALUES(updated_at)";

function provinceId(index: number): string {
  return `geo:prov:${String(index + 1).padStart(2, "0")}`;
}

async function main(): Promise<void> {
  console.log("🌱 Thai Knowledge (GEO) Seed");
  console.log(`Mode: ${shouldExec ? "EXEC" : "DRY-RUN"}`);

  let counter = 0;
  for (const [index, province] of PROVINCES.entries()) {
    const id = provinceId(index);
    const aliases: string[] = [];
    if (province.name === "กรุงเทพมหานคร") aliases.push("กทม", "กรุงเทพฯ", "บางกอก");
    if (province.name === "นครราชสีมา") aliases.push("โคราช");

    const attributes = {
      province: province.name,
      region: province.region,
      lat: province.lat,
      lon: province.lon,
      country: "TH",
    };

    const source = [{ name: "DOPA", url: "https://www.dopa.go.th" }];
    const params = [
      id,
      province.name,
      JSON.stringify(aliases),
      `จังหวัด${province.name} อยู่ในภาค${province.region}`,
      JSON.stringify(attributes),
      JSON.stringify([]),
      JSON.stringify(source),
      1.0, // Initial seed gets 1.0 confidence
      "1.0.0",
      new Date().toISOString(),
    ];

    if (!shouldExec) {
      if (counter < 5) {
        console.log("Dry Run Query:", UPSERT_SQL);
        console.log("Dry Run Params:", params);
      }
      counter += 1;
      continue;
    }

    try {
        await query(UPSERT_SQL, params);
        console.log(`✅ Upserted ${id} - ${province.name}`);
        counter += 1;
    } catch(err) {
        console.log(`❌ Failed ${id} - ${province.name}: ${err}`);
    }
  }

  console.log(`✅ Prepared ${counter} provinces`);
  if (!shouldExec) {
    console.log("Run with --exec to write into DB");
  } else {
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("❌ seed_thai_provinces failed", error);
  process.exitCode = 1;
});
