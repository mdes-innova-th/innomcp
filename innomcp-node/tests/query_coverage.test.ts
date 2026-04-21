import { describe, expect, test } from '@jest/globals';
import { planAnswer } from '../src/utils/mcp/answerPlanner';

type ExpectedIntent = 'general' | 'weather' | 'evidence' | 'web-record';

interface QueryCase {
  query: string;
  intent: ExpectedIntent;
}

const QUERY_CASES: QueryCase[] = [
  // Weather queries
  { query: 'อากาศกรุงเทพวันนี้เป็นอย่างไร', intent: 'weather' },
  { query: 'พยากรณ์ฝนพรุ่งนี้เชียงใหม่', intent: 'weather' },
  { query: 'Weather forecast Phuket', intent: 'weather' },
  { query: 'อุณหภูมิสูงสุดวันนี้ในสงขลา', intent: 'weather' },
  { query: 'NWP forecast Bangkok', intent: 'weather' },
  { query: 'สภาพอากาศวันนี้ที่ระยอง', intent: 'weather' },
  { query: 'เตือนภัยฝนตกหนักภาคเหนือ', intent: 'weather' },
  { query: 'รายงานอากาศอุณหภูมิและฝนสำหรับภาคใต้', intent: 'weather' },
  { query: 'weather conditions for Hua Hin', intent: 'weather' },
  { query: 'พยากรณ์อุณหภูมิในขอนแก่น', intent: 'weather' },
  { query: 'TMD weather alert for Bangkok', intent: 'weather' },
  { query: 'ฝนตกหนักในภาคอีสานหรือไม่', intent: 'weather' },
  { query: 'weather forecast Ayutthaya', intent: 'weather' },
  { query: 'สถานีอุตุนิยมวิทยารายงานอะไรวันนี้', intent: 'weather' },
  { query: 'อากาศร้อนมากในนครราชสีมาหรือเปล่า', intent: 'weather' },
  { query: 'weather rain hourly Chiang Mai', intent: 'weather' },
  { query: 'สภาพอากาศปัจจุบันที่พัทยา', intent: 'weather' },
  { query: 'ฝนจะหยุดตกเมื่อไร', intent: 'weather' },
  { query: 'อุณหภูมิคืนนี้ที่ภูเก็ต', intent: 'weather' },
  { query: 'weather update with humidity', intent: 'weather' },
  { query: 'weather tomorrow in Surat Thani', intent: 'weather' },
  { query: 'อากาศหนาวเชียงรายวันนี้', intent: 'weather' },
  { query: 'เตือนภัยพายุสำหรับภาคใต้', intent: 'weather' },
  { query: 'weather alert for Chiang Mai', intent: 'weather' },
  { query: 'อากาศมีฝนในภูเก็ตไหม', intent: 'weather' },

  // Evidence queries
  { query: 'รายงาน NIP ล่าสุดของ AIS', intent: 'evidence' },
  { query: 'detect illegal traffic at True network', intent: 'evidence' },
  { query: 'สถิติ url ผิดกฎหมาย', intent: 'evidence' },
  { query: 'evidence summary for illegal content', intent: 'evidence' },
  { query: 'NIP statistics by ISP', intent: 'evidence' },
  { query: 'traffic report from ISP networks', intent: 'evidence' },
  { query: 'forensic evidence record count', intent: 'evidence' },
  { query: 'pending evidence records status', intent: 'evidence' },
  { query: 'machine online status in evidence system', intent: 'evidence' },
  { query: 'how many evidence machines are offline', intent: 'evidence' },
  { query: 'detect url violations for AIS', intent: 'evidence' },
  { query: 'report NIP latest entries', intent: 'evidence' },
  { query: 'evidence analytics for traffic', intent: 'evidence' },
  { query: 'evidence graph for ISP data', intent: 'evidence' },
  { query: 'สรุปหลักฐาน url ผิดกฎหมายจาก dtac', intent: 'evidence' },
  { query: 'show latest nip entries for True', intent: 'evidence' },
  { query: 'detect malicious url traffic', intent: 'evidence' },
  { query: 'evidence statistics for phishing attacks', intent: 'evidence' },
  { query: 'รายงานคดีออนไลน์ล่าสุด', intent: 'evidence' },
  { query: 'traffic detect report for ISP networks', intent: 'evidence' },
  { query: 'evidence summary for TrueOnline', intent: 'evidence' },
  { query: 'data from detect analytics about url traffic', intent: 'evidence' },
  { query: 'รหัส NIP สถิติ', intent: 'evidence' },
  { query: 'evidence record for machine status', intent: 'evidence' },
  { query: 'forensic report on illegal traffic', intent: 'evidence' },

  // Web-record queries
  { query: 'เว็บไซต์ไหนมีข้อมูล blockchain', intent: 'web-record' },
  { query: 'แหล่งข้อมูลอ้างอิงเกี่ยวกับ cyber security', intent: 'web-record' },
  { query: 'web record ของข่าว AI', intent: 'web-record' },
  { query: 'อ้างอิงจากเว็บไซต์สำหรับ JavaScript', intent: 'web-record' },
  { query: 'บันทึกเว็บสำหรับ API', intent: 'web-record' },
  { query: 'website record of cloud computing', intent: 'web-record' },
  { query: 'record website review for phishing', intent: 'web-record' },
  { query: 'หาข้อมูลจากเว็บไซต์เกี่ยวกับ DevOps', intent: 'web-record' },
  { query: 'เว็บไซต์อ้างอิง REST APIs', intent: 'web-record' },
  { query: 'บันทึกเว็บเกี่ยวกับ cloud service', intent: 'web-record' },
  { query: 'web record for machine learning', intent: 'web-record' },
  { query: 'เว็บไซต์อ้างอิงข้อมูลเทคโนโลยี', intent: 'web-record' },
  { query: 'web record for data analytics', intent: 'web-record' },
  { query: 'web record for TCP and UDP', intent: 'web-record' },
  { query: 'ข้อมูลเว็บไซต์เกี่ยวกับ API', intent: 'web-record' },
  { query: 'อ้างอิงเว็บไซต์สำหรับข้อมูลเทคโนโลยี', intent: 'web-record' },
  { query: 'บันทึกเว็บเกี่ยวกับ phishing', intent: 'web-record' },
  { query: 'web record for temperature data', intent: 'web-record' },
  { query: 'บันทึกเว็บข้อมูลโปรโตคอล', intent: 'web-record' },
  { query: 'web record for programming trends', intent: 'web-record' },

  // General queries
  { query: 'AI คืออะไร', intent: 'general' },
  { query: 'JavaScript คืออะไร', intent: 'general' },
  { query: 'Big Data คืออะไร', intent: 'general' },
  { query: 'Cloud computing เป็นอย่างไร', intent: 'general' },
  { query: 'DevOps ทำงานยังไง', intent: 'general' },
  { query: 'machine learning แบบง่าย ๆ', intent: 'general' },
  { query: 'blockchain คืออะไร', intent: 'general' },
  { query: 'cyber security เบื้องต้น', intent: 'general' },
  { query: 'API คืออะไร', intent: 'general' },
  { query: 'ทำไมต้องใช้ JavaScript', intent: 'general' },
  { query: 'ช่วยอธิบาย cloud services ให้ฟัง', intent: 'general' },
  { query: 'ทำงานของ Big Data', intent: 'general' },
  { query: 'ความแตกต่างระหว่าง TCP กับ UDP', intent: 'general' },
  { query: 'what can you do', intent: 'general' },
  { query: 'who are you', intent: 'general' },
  { query: 'what is your name', intent: 'general' },
  { query: 'how does machine learning work', intent: 'general' },
  { query: 'why use DevOps practices', intent: 'general' },
  { query: 'explain API in simple terms', intent: 'general' },
  { query: 'การใช้ blockchain ในธุรกิจ', intent: 'general' },
  { query: 'วิธีป้องกัน phishing', intent: 'general' },
  { query: 'การเขียนโปรแกรมด้วย JavaScript', intent: 'general' },
  { query: 'what is cloud computing', intent: 'general' },
  { query: 'why is cybersecurity important', intent: 'general' },
  { query: 'how does Big Data help business', intent: 'general' },
];

describe('Query coverage tests for tools and API intent routing', () => {
  test.each(QUERY_CASES)('should classify "%s" as %s', ({ query, intent }) => {
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
