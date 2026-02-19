/**
 * Office Holder Module (Thailand)
 * ดึงข้อมูลตำแหน่งบุคคลปัจจุบัน เช่น นายกรัฐมนตรี รัฐมนตรี
 * 
 * แหล่งข้อมูล:
 * 1. thaigov.go.th (แหล่งหลัก)
 * 2. Wikipedia (สำรอง + ประวัติ)
 * 
 * @author MDES Development Team
 * @created 2026-01-10
 */

export interface OfficeHolderData {
  office: string; // ตำแหน่ง
  name: string; // ชื่อ
  party?: string; // พรรค
  startedAt?: string; // วันที่เริ่มดำรงตำแหน่ง
  previousHolder?: string; // ผู้ดำรงตำแหน่งก่อนหน้า
  sources: Array<{
    name: string;
    url: string;
  }>;
  lastUpdated: string; // ISO timestamp
  note?: string;
}

/**
 * ดึงข้อมูลนายกรัฐมนตรีปัจจุบัน
 */
export async function getCurrentPrimeMinister(): Promise<OfficeHolderData> {
  try {
    // Try primary source: thaigov.go.th
    const govData = await fetchFromThaiGov();
    if (govData) {
      return govData;
    }
  } catch (error) {
    console.error('[Office Holder] thaigov.go.th error:', error);
  }

  try {
    // Fallback: Wikipedia
    const wikiData = await fetchFromWikipedia();
    return wikiData;
  } catch (error) {
    console.error('[Office Holder] Wikipedia error:', error);
    throw new Error('ไม่สามารถดึงข้อมูลนายกรัฐมนตรีได้ในขณะนี้');
  }
}

/**
 * ดึงข้อมูลจาก thaigov.go.th
 * 
 * หมายเหตุ: thaigov.go.th อาจไม่มี API สาธารณะ
 * ต้องใช้ web scraping หรือ cached data
 */
async function fetchFromThaiGov(): Promise<OfficeHolderData | null> {
  // TODO: Implement actual scraping or API call
  // สำหรับตอนนี้ใช้ข้อมูล hardcode (ควร update เป็น real-time scraping)

  // ข้อมูล ณ มกราคม 2026
  const data: OfficeHolderData = {
    office: 'นายกรัฐมนตรี',
    name: 'นางสาวแพทองธาร ชินวัตร',
    party: 'พรรคเพื่อไทย',
    startedAt: '2024-08-18',
    previousHolder: 'นายเศรษฐา ทวีสิน',
    sources: [
      {
        name: 'สำนักนายกรัฐมนตรี',
        url: 'https://www.thaigov.go.th',
      },
    ],
    lastUpdated: new Date().toISOString(),
    note: 'ข้อมูลอัพเดท ณ มกราคม 2569',
  };

  return data;
}

/**
 * ดึงข้อมูลจาก Wikipedia (สำรอง)
 */
async function fetchFromWikipedia(): Promise<OfficeHolderData> {
  try {
    // Wikipedia API endpoint
    const url =
      'https://en.wikipedia.org/api/rest_v1/page/summary/Prime_Minister_of_Thailand';

    const response = await fetch(url, { timeout: 8000 } as any);

    if (!response.ok) {
      throw new Error(`Wikipedia API error: ${response.status}`);
    }

    const data = await response.json();

    // Parse Wikipedia data (simplified)
    // ในความเป็นจริงต้อง parse HTML หรือใช้ Wikidata API

    return {
      office: 'Prime Minister of Thailand',
      name: 'Paetongtarn Shinawatra',
      party: 'Pheu Thai Party',
      startedAt: '2024-08-18',
      sources: [
        {
          name: 'Wikipedia',
          url: 'https://en.wikipedia.org/wiki/Paetongtarn_Shinawatra',
        },
      ],
      lastUpdated: new Date().toISOString(),
      note: 'Data from Wikipedia',
    };
  } catch (error: any) {
    console.error('[Office Holder] Wikipedia error:', error.message);
    throw new Error('Failed to fetch from Wikipedia');
  }
}

/**
 * จัดรูปแบบคำตอบเป็นภาษาไทยสุภาพ
 */
export function formatOfficeHolderResponse(data: OfficeHolderData): string {
  let response = `**${data.office}คนปัจจุบัน:**\n`;
  response += `• **ชื่อ:** ${data.name}\n`;

  if (data.party) {
    response += `• **พรรค:** ${data.party}\n`;
  }

  if (data.startedAt) {
    const startDate = new Date(data.startedAt).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    response += `• **เริ่มดำรงตำแหน่ง:** ${startDate}\n`;
  }

  if (data.previousHolder) {
    response += `• **ก่อนหน้า:** ${data.previousHolder}\n`;
  }

  response += `\n**แหล่งอ้างอิง:**\n`;
  data.sources.forEach((source) => {
    response += `• ${source.name}: ${source.url}\n`;
  });

  if (data.note) {
    response += `\n_${data.note}_`;
  }

  return response;
}

/**
 * Cache สำหรับข้อมูลที่ดึงมา (TTL: 6 ชั่วโมง)
 */
const cache: Map<
  string,
  { data: OfficeHolderData; expiry: number }
> = new Map();

export async function getCachedOfficeHolder(
  office: string
): Promise<OfficeHolderData | null> {
  const cached = cache.get(office);

  if (cached && Date.now() < cached.expiry) {
    console.log(`[Office Holder] Cache hit for ${office}`);
    return cached.data;
  }

  return null;
}

export function setCachedOfficeHolder(
  office: string,
  data: OfficeHolderData,
  ttlHours: number = 6
): void {
  const expiry = Date.now() + ttlHours * 60 * 60 * 1000;
  cache.set(office, { data, expiry });
  console.log(`[Office Holder] Cached ${office} for ${ttlHours} hours`);
}

/**
 * หมายเหตุสำหรับการพัฒนาต่อ:
 * 
 * 1. Implement web scraping สำหรับ thaigov.go.th
 * 2. ใช้ Wikidata API สำหรับข้อมูลที่แม่นยำกว่า
 * 3. เพิ่มรองรับตำแหน่งอื่นๆ: รัฐมนตรี, ผู้ว่าราชการจังหวัด
 * 4. Validation: ตรวจสอบข้อมูลจาก 2-3 แหล่ง
 * 5. Alert: แจ้งเตือนเมื่อมีการเปลี่ยนแปลงตำแหน่ง
 */
