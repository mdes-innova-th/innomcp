export type KeywordSource = 'db' | 'snapshot' | 'defaults';

export interface SnapshotKeyword {
  keyword: string;
  category: string;
  confidence_score: number;
  priority_level: string;
}

// Static snapshot for resilience when DB keyword_training is unavailable.
// Keep this small, high-signal, and deterministic.
export const KEYWORD_SNAPSHOT: SnapshotKeyword[] = [
  // evidence
  { keyword: 'หลักฐานค้าง', category: 'evidence', confidence_score: 0.92, priority_level: 'high' },
  { keyword: 'ตรวจสอบ evidence', category: 'evidence', confidence_score: 0.9, priority_level: 'high' },
  { keyword: 'ล่าสุด threat', category: 'evidence', confidence_score: 0.9, priority_level: 'high' },
  { keyword: 'รายงาน threat', category: 'evidence', confidence_score: 0.88, priority_level: 'high' },

  // weather
  { keyword: 'กรมอุตุนิยมวิทยา', category: 'weather', confidence_score: 0.94, priority_level: 'high' },
  { keyword: 'พยากรณ์อากาศวันนี้', category: 'weather', confidence_score: 0.9, priority_level: 'high' },
  { keyword: 'ฝนตกหนัก', category: 'weather', confidence_score: 0.9, priority_level: 'high' },
  { keyword: 'อากาศร้อนจัด', category: 'weather', confidence_score: 0.88, priority_level: 'high' },

  // nasa
  { keyword: 'ภาพดาราศาสตร์ประจำวัน', category: 'nasa', confidence_score: 0.92, priority_level: 'high' },
  { keyword: 'apod วันนี้', category: 'nasa', confidence_score: 0.9, priority_level: 'high' },
  { keyword: 'กล้องโทรทรรศน์', category: 'nasa', confidence_score: 0.86, priority_level: 'med' },

  // worldbank
  { keyword: 'per capita', category: 'worldbank', confidence_score: 0.9, priority_level: 'high' },
  { keyword: 'inflation', category: 'worldbank', confidence_score: 0.88, priority_level: 'high' },
  { keyword: 'unemployment', category: 'worldbank', confidence_score: 0.86, priority_level: 'med' },

  // calculator
  { keyword: 'sin', category: 'calculator', confidence_score: 0.92, priority_level: 'high' },
  { keyword: 'cos', category: 'calculator', confidence_score: 0.9, priority_level: 'med' },
  { keyword: 'log10', category: 'calculator', confidence_score: 0.86, priority_level: 'med' },

  // datetime
  { keyword: 'utc', category: 'datetime', confidence_score: 0.92, priority_level: 'high' },
  { keyword: 'timestamp', category: 'datetime', confidence_score: 0.88, priority_level: 'med' },

  // translation
  { keyword: 'EN-TH', category: 'translation', confidence_score: 0.86, priority_level: 'med' },
  { keyword: 'TH-EN', category: 'translation', confidence_score: 0.86, priority_level: 'med' },

  // qrcode
  { keyword: 'คิวอาร์โค้ด', category: 'qrcode', confidence_score: 0.9, priority_level: 'high' },
  { keyword: 'สร้างคิวอาร์', category: 'qrcode', confidence_score: 0.88, priority_level: 'med' },

  // ocr
  { keyword: 'อ่านข้อความจากรูป', category: 'ocr', confidence_score: 0.9, priority_level: 'high' },
  { keyword: 'ดึงข้อความจากภาพ', category: 'ocr', confidence_score: 0.88, priority_level: 'med' },

  // visualization
  { keyword: 'บาร์ชาร์ต', category: 'visualization', confidence_score: 0.9, priority_level: 'high' },
  { keyword: 'กราฟแท่ง', category: 'visualization', confidence_score: 0.88, priority_level: 'high' },

  // files
  { keyword: 'pptx', category: 'files', confidence_score: 0.86, priority_level: 'med' },
  { keyword: 'สรุปไฟล์ pdf', category: 'files', confidence_score: 0.88, priority_level: 'med' },
];
