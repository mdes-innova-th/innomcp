// MDES (กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม) constants for INNOMCP platform
export const MDES_OLLAMA_URL = 'https://ollama.mdes-innova.online';
export const MDES_THAILLM_URL = 'https://api.thaillm.mdes.go.th/v1';

// MDES Brand Colors
export const MDES_COLORS = {
  primary: '#1a3c6e',
  primaryLight: '#2d5a9e',
  accent: '#c8973e',
  accentLight: '#e8b85e',
  thai: '#C00000',  // Thai red
} as const;

// Thai Government Provinces (all 77)
export const THAI_PROVINCES: Array<{ name: string; nameEN: string; region: string; code: string; }> = [
  { name: 'กรุงเทพมหานคร', nameEN: 'Bangkok', region: 'กลาง', code: '10' },
  { name: 'กระบี่', nameEN: 'Krabi', region: 'ใต้', code: '81' },
  { name: 'กาญจนบุรี', nameEN: 'Kanchanaburi', region: 'ตะวันตก', code: '71' },
  { name: 'กาฬสินธุ์', nameEN: 'Kalasin', region: 'อีสาน', code: '46' },
  { name: 'กำแพงเพชร', nameEN: 'Kamphaeng Phet', region: 'กลาง', code: '62' },
  { name: 'ขอนแก่น', nameEN: 'Khon Kaen', region: 'อีสาน', code: '40' },
  { name: 'จันทบุรี', nameEN: 'Chanthaburi', region: 'ตะวันออก', code: '22' },
  { name: 'ฉะเชิงเทรา', nameEN: 'Chachoengsao', region: 'ตะวันออก', code: '24' },
  { name: 'ชลบุรี', nameEN: 'Chon Buri', region: 'ตะวันออก', code: '20' },
  { name: 'ชัยนาท', nameEN: 'Chai Nat', region: 'กลาง', code: '18' },
  { name: 'ชัยภูมิ', nameEN: 'Chaiyaphum', region: 'อีสาน', code: '36' },
  { name: 'ชุมพร', nameEN: 'Chumphon', region: 'ใต้', code: '86' },
  { name: 'เชียงราย', nameEN: 'Chiang Rai', region: 'เหนือ', code: '57' },
  { name: 'เชียงใหม่', nameEN: 'Chiang Mai', region: 'เหนือ', code: '50' },
  { name: 'ตรัง', nameEN: 'Trang', region: 'ใต้', code: '92' },
  { name: 'ตราด', nameEN: 'Trat', region: 'ตะวันออก', code: '23' },
  { name: 'ตาก', nameEN: 'Tak', region: 'ตะวันตก', code: '63' },
  { name: 'นครนายก', nameEN: 'Nakhon Nayok', region: 'กลาง', code: '26' },
  { name: 'นครปฐม', nameEN: 'Nakhon Pathom', region: 'กลาง', code: '73' },
  { name: 'นครพนม', nameEN: 'Nakhon Phanom', region: 'อีสาน', code: '48' },
  { name: 'นครราชสีมา', nameEN: 'Nakhon Ratchasima', region: 'อีสาน', code: '30' },
  { name: 'นครศรีธรรมราช', nameEN: 'Nakhon Si Thammarat', region: 'ใต้', code: '80' },
  { name: 'นครสวรรค์', nameEN: 'Nakhon Sawan', region: 'กลาง', code: '60' },
  { name: 'นนทบุรี', nameEN: 'Nonthaburi', region: 'กลาง', code: '12' },
  { name: 'นราธิวาส', nameEN: 'Narathiwat', region: 'ใต้', code: '96' },
  { name: 'น่าน', nameEN: 'Nan', region: 'เหนือ', code: '55' },
  { name: 'บึงกาฬ', nameEN: 'Bueng Kan', region: 'อีสาน', code: '38' },
  { name: 'บุรีรัมย์', nameEN: 'Buri Ram', region: 'อีสาน', code: '31' },
  { name: 'ปทุมธานี', nameEN: 'Pathum Thani', region: 'กลาง', code: '13' },
  { name: 'ประจวบคีรีขันธ์', nameEN: 'Prachuap Khiri Khan', region: 'ตะวันตก', code: '77' },
  { name: 'ปราจีนบุรี', nameEN: 'Prachin Buri', region: 'ตะวันออก', code: '25' },
  { name: 'ปัตตานี', nameEN: 'Pattani', region: 'ใต้', code: '94' },
  { name: 'พระนครศรีอยุธยา', nameEN: 'Phra Nakhon Si Ayutthaya', region: 'กลาง', code: '14' },
  { name: 'พะเยา', nameEN: 'Phayao', region: 'เหนือ', code: '56' },
  { name: 'พังงา', nameEN: 'Phangnga', region: 'ใต้', code: '82' },
  { name: 'พัทลุง', nameEN: 'Phatthalung', region: 'ใต้', code: '93' },
  { name: 'พิจิตร', nameEN: 'Phichit', region: 'กลาง', code: '66' },
  { name: 'พิษณุโลก', nameEN: 'Phitsanulok', region: 'กลาง', code: '65' },
  { name: 'เพชรบุรี', nameEN: 'Phetchaburi', region: 'ตะวันตก', code: '76' },
  { name: 'เพชรบูรณ์', nameEN: 'Phetchabun', region: 'กลาง', code: '67' },
  { name: 'แพร่', nameEN: 'Phrae', region: 'เหนือ', code: '54' },
  { name: 'ภูเก็ต', nameEN: 'Phuket', region: 'ใต้', code: '83' },
  { name: 'มหาสารคาม', nameEN: 'Maha Sarakham', region: 'อีสาน', code: '44' },
  { name: 'มุกดาหาร', nameEN: 'Mukdahan', region: 'อีสาน', code: '49' },
  { name: 'แม่ฮ่องสอน', nameEN: 'Mae Hong Son', region: 'เหนือ', code: '58' },
  { name: 'ยโสธร', nameEN: 'Yasothon', region: 'อีสาน', code: '35' },
  { name: 'ยะลา', nameEN: 'Yala', region: 'ใต้', code: '95' },
  { name: 'ร้อยเอ็ด', nameEN: 'Roi Et', region: 'อีสาน', code: '45' },
  { name: 'ระนอง', nameEN: 'Ranong', region: 'ใต้', code: '85' },
  { name: 'ระยอง', nameEN: 'Rayong', region: 'ตะวันออก', code: '21' },
  { name: 'ราชบุรี', nameEN: 'Ratchaburi', region: 'ตะวันตก', code: '70' },
  { name: 'ลพบุรี', nameEN: 'Lop Buri', region: 'กลาง', code: '16' },
  { name: 'ลำปาง', nameEN: 'Lampang', region: 'เหนือ', code: '52' },
  { name: 'ลำพูน', nameEN: 'Lamphun', region: 'เหนือ', code: '51' },
  { name: 'เลย', nameEN: 'Loei', region: 'อีสาน', code: '42' },
  { name: 'ศรีสะเกษ', nameEN: 'Si Sa Ket', region: 'อีสาน', code: '33' },
  { name: 'สกลนคร', nameEN: 'Sakon Nakhon', region: 'อีสาน', code: '47' },
  { name: 'สงขลา', nameEN: 'Songkhla', region: 'ใต้', code: '90' },
  { name: 'สตูล', nameEN: 'Satun', region: 'ใต้', code: '91' },
  { name: 'สมุทรปราการ', nameEN: 'Samut Prakan', region: 'กลาง', code: '11' },
  { name: 'สมุทรสงคราม', nameEN: 'Samut Songkhram', region: 'กลาง', code: '75' },
  { name: 'สมุทรสาคร', nameEN: 'Samut Sakhon', region: 'กลาง', code: '74' },
  { name: 'สระแก้ว', nameEN: 'Sa Kaeo', region: 'ตะวันออก', code: '27' },
  { name: 'สระบุรี', nameEN: 'Saraburi', region: 'กลาง', code: '19' },
  { name: 'สิงห์บุรี', nameEN: 'Sing Buri', region: 'กลาง', code: '17' },
  { name: 'สุโขทัย', nameEN: 'Sukhothai', region: 'กลาง', code: '64' },
  { name: 'สุพรรณบุรี', nameEN: 'Suphan Buri', region: 'กลาง', code: '72' },
  { name: 'สุราษฎร์ธานี', nameEN: 'Surat Thani', region: 'ใต้', code: '84' },
  { name: 'สุรินทร์', nameEN: 'Surin', region: 'อีสาน', code: '32' },
  { name: 'หนองคาย', nameEN: 'Nong Khai', region: 'อีสาน', code: '43' },
  { name: 'หนองบัวลำภู', nameEN: 'Nong Bua Lam Phu', region: 'อีสาน', code: '39' },
  { name: 'อ่างทอง', nameEN: 'Ang Thong', region: 'กลาง', code: '15' },
  { name: 'อำนาจเจริญ', nameEN: 'Amnat Charoen', region: 'อีสาน', code: '37' },
  { name: 'อุดรธานี', nameEN: 'Udon Thani', region: 'อีสาน', code: '41' },
  { name: 'อุตรดิตถ์', nameEN: 'Uttaradit', region: 'เหนือ', code: '53' },
  { name: 'อุทัยธานี', nameEN: 'Uthai Thani', region: 'กลาง', code: '61' },
  { name: 'อุบลราชธานี', nameEN: 'Ubon Ratchathani', region: 'อีสาน', code: '34' },
] as const;

// MDES Model Families (MDES Ollama)
export const MDES_MODEL_FAMILIES = ['gemma', 'qwen', 'llama', 'deepseek', 'mistral', 'phi'] as const;

// Government MCP Tool Names
export const MCP_TOOLS = {
  EVIDENCE: 'detect_evidence_stats',
  GEO: 'thai_geo_tool',
  STATUS: 'system_status_tool',
  KNOWLEDGE: 'thaiKnowledgeTool',
} as const;

// Chat limits
export const CHAT_LIMITS = {
  MAX_INPUT_CHARS: 4000,
  MAX_HISTORY_MESSAGES: 20,
  MAX_ATTACHMENTS: 5,
  MAX_FILE_SIZE_MB: 5,
} as const;