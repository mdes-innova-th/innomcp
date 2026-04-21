import { describe, expect, test } from '@jest/globals';
import { planAnswer } from '../src/utils/mcp/answerPlanner';

type ExpectedIntent = 'general' | 'weather' | 'evidence' | 'web-record';

interface QueryCase {
  query: string;
  intent: ExpectedIntent;
}

/**
 * Routing priority in answerPlanner:  weather → evidence → web-record → general
 *
 * hasWeatherIntent:    อากาศ|ฝน|พยากรณ์|weather|อุณหภูมิ|NWP|nwp|อุตุ|แผ่นดินไหว|seismic|ริกเตอร์|earthquake|เตือนภัย|ประกาศเตือน|สถานีอุตุ
 * hasEvidenceIntent:   หลักฐาน|พยาน|คดี|custody|forensic|evidence|สถิติ|กราฟ|ISP|traffic|detect|nip
 *   (excluded if: worldbank/gdp/nasa/archive pattern, or NIP definitional query)
 * hasWebRecordIntent:  อ้างอิง|แหล่งข้อมูล|เว็บ|record|เว็บไซต์|บันทึก
 */
const QUERY_CASES_V2: QueryCase[] = [
  // ── WEATHER (25) ─────────────────────────────────────────────────────────
  { query: 'ฝนจะตกที่กระบี่ไหมพรุ่งนี้', intent: 'weather' },
  { query: 'อากาศจังหวัดชลบุรีเป็นอย่างไร', intent: 'weather' },
  { query: 'พยากรณ์ฟ้าหลัวภาคกลาง', intent: 'weather' },
  { query: 'แผ่นดินไหวในภาคเหนือวันนี้', intent: 'weather' },
  { query: 'เตือนภัยน้ำท่วมภาคใต้', intent: 'weather' },
  { query: 'อุณหภูมิขั้นต่ำในมุกดาหาร', intent: 'weather' },
  { query: 'สถานีอุตุฯ แจ้งเตือนพายุ', intent: 'weather' },
  { query: 'NWP model run for southern Thailand', intent: 'weather' },
  { query: 'seismic activity near Chiang Rai', intent: 'weather' },
  { query: 'earthquake magnitude report today', intent: 'weather' },
  { query: 'weather in Udon Thani this week', intent: 'weather' },
  { query: 'อากาศทะเลอ่าวไทยเป็นอย่างไร', intent: 'weather' },
  { query: 'ฝนตกหนักในสุราษฎร์ธานีหรือเปล่า', intent: 'weather' },
  { query: 'อุณหภูมิน้ำทะเลอ่าวไทย', intent: 'weather' },
  { query: 'ริกเตอร์สเกลวันนี้ในภาคกลาง', intent: 'weather' },
  { query: 'ประกาศเตือนพายุฤดูร้อน', intent: 'weather' },
  { query: 'weather data from TMD API', intent: 'weather' },
  { query: 'อุตุวันนี้รายงานอะไร', intent: 'weather' },
  { query: 'seismic sensor reading from northern region', intent: 'weather' },
  { query: 'NWP output for next 48 hours', intent: 'weather' },
  { query: 'weather hourly in Lampang', intent: 'weather' },
  { query: 'ฝนตกในเชียงใหม่ตอนเย็น', intent: 'weather' },
  { query: 'พยากรณ์อากาศสำหรับวันหยุดสงกรานต์', intent: 'weather' },
  { query: 'อุณหภูมิก่อนขึ้นเครื่องบิน', intent: 'weather' },
  { query: 'earthquake warning in Tak province', intent: 'weather' },

  // ── EVIDENCE (25) ─────────────────────────────────────────────────────────
  { query: 'นับจำนวน ISP ที่ถูกตรวจสอบ', intent: 'evidence' },
  { query: 'สถิติการตรวจจับเวปผิดกฎหมาย', intent: 'evidence' },
  { query: 'กราฟแสดงข้อมูล ISP ย้อนหลัง', intent: 'evidence' },
  { query: 'chain of custody for digital evidence', intent: 'evidence' },
  { query: 'พยานในคดีไซเบอร์', intent: 'evidence' },
  { query: 'คดีฉ้อโกงออนไลน์เดือนนี้', intent: 'evidence' },
  { query: 'นับจำนวนหลักฐานดิจิทัล', intent: 'evidence' },
  { query: 'ISP ใดมีการละเมิดมากที่สุด', intent: 'evidence' },
  { query: 'detect suspicious traffic pattern', intent: 'evidence' },
  { query: 'traffic analysis for AIS network', intent: 'evidence' },
  { query: 'forensic analysis of network logs', intent: 'evidence' },
  { query: 'evidence chain for cybercrime case', intent: 'evidence' },
  { query: 'NIP record count by month', intent: 'evidence' },
  { query: 'detect phishing site activity', intent: 'evidence' },
  { query: 'ISP traffic volume this week', intent: 'evidence' },
  { query: 'กราฟเปรียบเทียบ NIP รายเดือน', intent: 'evidence' },
  { query: 'สถิติเครื่องออนไลน์ในระบบ', intent: 'evidence' },
  { query: 'custody log for captured packets', intent: 'evidence' },
  { query: 'หลักฐานเชื่อมโยงคดีออนไลน์', intent: 'evidence' },
  { query: 'พยานผู้เชี่ยวชาญด้านคอมพิวเตอร์', intent: 'evidence' },
  { query: 'evidence dashboard for True ISP', intent: 'evidence' },
  { query: 'nip entry export for audit', intent: 'evidence' },
  { query: 'forensic log of captured packets', intent: 'evidence' },
  { query: 'traffic spike detect on dtac network', intent: 'evidence' },
  { query: 'ISP compliance report for Q1', intent: 'evidence' },

  // ── WEB-RECORD (25) ───────────────────────────────────────────────────────
  { query: 'หาแหล่งข้อมูลเกี่ยวกับ Python', intent: 'web-record' },
  { query: 'เว็บไซต์ข้อมูล Docker', intent: 'web-record' },
  { query: 'บันทึกแหล่งข้อมูล Kubernetes', intent: 'web-record' },
  { query: 'อ้างอิงเว็บ Nginx documentation', intent: 'web-record' },
  { query: 'web record for React framework', intent: 'web-record' },
  { query: 'record source for Linux commands', intent: 'web-record' },
  { query: 'เว็บอ้างอิงหลักสูตร Data Science', intent: 'web-record' },
  { query: 'แหล่งข้อมูล Node.js best practices', intent: 'web-record' },
  { query: 'บันทึกเว็บสำหรับ REST API design', intent: 'web-record' },
  { query: 'เว็บไซต์อ้างอิงภาษา TypeScript', intent: 'web-record' },
  { query: 'web record for database optimization', intent: 'web-record' },
  { query: 'หาเว็บข้อมูล microservices', intent: 'web-record' },
  { query: 'บันทึกข้อมูลจากเว็บเกี่ยวกับ CI/CD', intent: 'web-record' },
  { query: 'อ้างอิงหน้าเว็บ Docker Compose', intent: 'web-record' },
  { query: 'web record for GraphQL vs REST', intent: 'web-record' },
  { query: 'record of online resources for Go language', intent: 'web-record' },
  { query: 'แหล่งข้อมูลสำหรับ SQL optimization', intent: 'web-record' },
  { query: 'เว็บไซต์เกี่ยวกับ software architecture', intent: 'web-record' },
  { query: 'บันทึกแหล่งข้อมูลสำหรับ AI tools', intent: 'web-record' },
  { query: 'web record for Kubernetes deployment', intent: 'web-record' },
  { query: 'อ้างอิงจากเว็บสำหรับ unit testing', intent: 'web-record' },
  { query: 'เว็บอ้างอิงสำหรับ design patterns', intent: 'web-record' },
  { query: 'record page of Python packaging', intent: 'web-record' },
  { query: 'บันทึกเว็บไซต์สำหรับ open source libs', intent: 'web-record' },
  { query: 'แหล่งข้อมูลในเว็บสำหรับ Linux networking', intent: 'web-record' },

  // ── GENERAL (25) ──────────────────────────────────────────────────────────
  { query: 'Python คืออะไร', intent: 'general' },
  { query: 'TypeScript มีประโยชน์อะไร', intent: 'general' },
  { query: 'Docker ใช้ทำอะไร', intent: 'general' },
  { query: 'Kubernetes คืออะไร', intent: 'general' },
  { query: 'Git workflow คืออะไร', intent: 'general' },
  { query: 'CI/CD ทำงานอย่างไร', intent: 'general' },
  { query: 'microservices architecture คืออะไร', intent: 'general' },
  { query: 'ความแตกต่างระหว่าง SQL และ NoSQL', intent: 'general' },
  { query: 'GraphQL เป็นอย่างไร', intent: 'general' },
  { query: 'อธิบาย REST vs gRPC', intent: 'general' },
  { query: 'ทำไมต้องใช้ TypeScript แทน JavaScript', intent: 'general' },
  { query: 'ขั้นตอนการเขียน unit test', intent: 'general' },
  { query: 'แนะนำ framework สำหรับ backend', intent: 'general' },
  { query: 'การออกแบบ database schema', intent: 'general' },
  { query: 'JWT คืออะไรและใช้อย่างไร', intent: 'general' },
  { query: 'ความแตกต่างของ async และ sync', intent: 'general' },
  { query: 'เขียน Docker Compose อย่างไร', intent: 'general' },
  { query: 'Linux command line basics', intent: 'general' },
  { query: 'version control คืออะไร', intent: 'general' },
  { query: 'software quality assurance คืออะไร', intent: 'general' },
  { query: 'อธิบาย object-oriented programming', intent: 'general' },
  { query: 'ข้อดีของ serverless architecture', intent: 'general' },
  { query: 'SOLID principles คืออะไร', intent: 'general' },
  { query: 'design patterns ที่นิยมใช้', intent: 'general' },
  { query: 'กระบวนการ code review คืออะไร', intent: 'general' },
];

describe('Query coverage v2 — 100 new cases for tools and API intent routing', () => {
  test.each(QUERY_CASES_V2)('should classify "%s" as %s', ({ query, intent }) => {
    const plan = planAnswer(query);
    expect(plan.intent).toBe(intent);

    if (intent === 'weather') {
      expect(plan.steps).toHaveLength(1);
      expect(plan.steps[0].name).toContain('weather');
    } else if (intent === 'evidence') {
      expect(plan.steps).toHaveLength(1);
      expect(plan.steps[0].name).toContain('evidenceTool');
    } else if (intent === 'web-record') {
      expect(plan.steps).toHaveLength(1);
      expect(plan.steps[0].name).toContain('records adapter');
    } else {
      expect(plan.steps).toEqual([]);
    }
  });
});
