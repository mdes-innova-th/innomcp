-- ================================
-- Comprehensive Keyword Training Seed Data
-- For INNOMCP God-Tier Context-Aware Intent Engine
-- ================================

-- Enable safe updates and disable foreign key checks for bulk insert
SET SQL_SAFE_UPDATES = 0;
SET FOREIGN_KEY_CHECKS = 0;

-- Insert comprehensive keywords for all tool categories
INSERT INTO keyword_training (keyword, category, subcategory, language, confidence_score, priority_level, match_type, created_by) VALUES

-- ================================
-- WEATHER CATEGORY (NWP + TMD)
-- ================================
-- NWP Keywords (พยากรณ์อากาศ HPC)
('พยากรณ์', 'weather', 'nwp', 'th', 1.00, 'critical', 'exact', 'manual'),
('พยากรณ์อากาศ', 'weather', 'nwp', 'th', 1.00, 'critical', 'exact', 'manual'),
('อากาศ', 'weather', 'nwp', 'th', 0.95, 'high', 'exact', 'manual'),
('สภาพอากาศ', 'weather', 'nwp', 'th', 1.00, 'critical', 'exact', 'manual'),
('ฝน', 'weather', 'nwp', 'th', 0.90, 'high', 'exact', 'manual'),
('ฝนตก', 'weather', 'nwp', 'th', 0.95, 'high', 'exact', 'manual'),
('อุณหภูมิ', 'weather', 'nwp', 'th', 0.95, 'high', 'exact', 'manual'),
('รายวัน', 'weather', 'nwp', 'th', 0.90, 'high', 'exact', 'manual'),
('รายชั่วโมง', 'weather', 'nwp', 'th', 0.95, 'critical', 'exact', 'manual'),
('วันข้างหน้า', 'weather', 'nwp', 'th', 0.85, 'high', 'exact', 'manual'),
('ชม.ข้างหน้า', 'weather', 'nwp', 'th', 0.85, 'high', 'exact', 'manual'),
('ปริมาณฝน', 'weather', 'nwp', 'th', 0.95, 'high', 'exact', 'manual'),
('NWP', 'weather', 'nwp', 'en', 0.90, 'high', 'exact', 'manual'),
('HPC', 'weather', 'nwp', 'en', 0.85, 'medium', 'exact', 'manual'),

-- TMD Keywords (อุตุนิยมวิทยา)
('tmd', 'weather', 'tmd', 'en', 1.00, 'critical', 'exact', 'manual'),
('อุตุนิยมวิทยา', 'weather', 'tmd', 'th', 1.00, 'critical', 'exact', 'manual'),
('กรมอุตุนิยมวิทยา', 'weather', 'tmd', 'th', 1.00, 'critical', 'exact', 'manual'),
('คำเตือน', 'weather', 'tmd', 'th', 0.90, 'high', 'exact', 'manual'),
('พายุ', 'weather', 'tmd', 'th', 0.95, 'critical', 'exact', 'manual'),
('แผ่นดินไหว', 'weather', 'tmd', 'th', 0.95, 'critical', 'exact', 'manual'),
('สถานี', 'weather', 'tmd', 'th', 0.85, 'medium', 'exact', 'manual'),
('คลื่น', 'weather', 'tmd', 'th', 0.85, 'medium', 'exact', 'manual'),
('น้ำท่วม', 'weather', 'tmd', 'th', 0.90, 'high', 'exact', 'manual'),
('ภัยธรรมชาติ', 'weather', 'tmd', 'th', 0.90, 'high', 'exact', 'manual'),

-- General Weather Keywords
('กทม', 'weather', 'general', 'th', 0.90, 'high', 'exact', 'manual'),
('กรุงเทพ', 'weather', 'general', 'th', 0.90, 'high', 'exact', 'manual'),
('จังหวัด', 'weather', 'general', 'th', 0.85, 'high', 'exact', 'manual'),
('อำเภอ', 'weather', 'general', 'th', 0.80, 'medium', 'exact', 'manual'),
('ตำบล', 'weather', 'general', 'th', 0.80, 'medium', 'exact', 'manual'),
('เขต', 'weather', 'general', 'th', 0.75, 'medium', 'exact', 'manual'),
('แขวง', 'weather', 'general', 'th', 0.75, 'medium', 'exact', 'manual'),
('ภูมิภาค', 'weather', 'general', 'th', 0.85, 'high', 'exact', 'exact', 'manual'),
('ภาคเหนือ', 'weather', 'general', 'th', 0.85, 'high', 'exact', 'manual'),
('ภาคใต้', 'weather', 'general', 'th', 0.85, 'high', 'exact', 'manual'),
('ภาคตะวันออกเฉียงเหนือ', 'weather', 'general', 'th', 0.85, 'high', 'exact', 'manual'),
('ภาคกลาง', 'weather', 'general', 'th', 0.85, 'high', 'exact', 'manual'),
('ภาคตะวันออก', 'weather', 'general', 'th', 0.85, 'high', 'exact', 'manual'),
('lat=', 'weather', 'general', 'mixed', 0.90, 'high', 'exact', 'manual'),
('lon=', 'weather', 'general', 'mixed', 0.90, 'high', 'exact', 'manual'),

-- ================================
-- DATA CATEGORY (External Data Sources)
-- ================================
-- NASA Keywords
('nasa', 'data', 'nasa', 'en', 1.00, 'critical', 'exact', 'manual'),
('อวกาศ', 'data', 'nasa', 'th', 0.95, 'high', 'exact', 'manual'),
('ดาราศาสตร์', 'data', 'nasa', 'th', 0.95, 'high', 'exact', 'manual'),
('ดาวเคราะห์', 'data', 'nasa', 'th', 0.90, 'medium', 'exact', 'manual'),
('apod', 'data', 'nasa', 'en', 0.90, 'medium', 'exact', 'manual'),
('astronomy picture of the day', 'data', 'nasa', 'en', 0.95, 'high', 'exact', 'manual'),
('mars', 'data', 'nasa', 'en', 0.90, 'medium', 'exact', 'manual'),
('perseverance', 'data', 'nasa', 'en', 0.90, 'medium', 'exact', 'manual'),
('james webb', 'data', 'nasa', 'en', 0.90, 'medium', 'exact', 'manual'),
('hubble', 'data', 'nasa', 'en', 0.85, 'medium', 'exact', 'manual'),

-- WorldBank Keywords
('worldbank', 'data', 'worldbank', 'en', 1.00, 'critical', 'exact', 'manual'),
('ธนาคารโลก', 'data', 'worldbank', 'th', 0.95, 'high', 'exact', 'manual'),
('gdp', 'data', 'worldbank', 'en', 0.95, 'high', 'exact', 'manual'),
('เศรษฐกิจ', 'data', 'worldbank', 'th', 0.90, 'medium', 'exact', 'manual'),
('ประชากร', 'data', 'worldbank', 'th', 0.90, 'medium', 'exact', 'manual'),
('การพัฒนา', 'data', 'worldbank', 'th', 0.85, 'medium', 'exact', 'manual'),
('รายได้ต่อหัว', 'data', 'worldbank', 'th', 0.90, 'medium', 'exact', 'manual'),
('เงินเฟ้อ', 'data', 'worldbank', 'th', 0.85, 'medium', 'exact', 'manual'),
('การส่งออก', 'data', 'worldbank', 'th', 0.85, 'medium', 'exact', 'manual'),
('การนำเข้า', 'data', 'worldbank', 'th', 0.85, 'medium', 'exact', 'manual'),

-- GovData Keywords
('govdata', 'data', 'govdata', 'en', 1.00, 'critical', 'exact', 'manual'),
('ข้อมูลรัฐบาล', 'data', 'govdata', 'th', 0.95, 'high', 'exact', 'manual'),
('สถิติ', 'data', 'govdata', 'th', 0.90, 'medium', 'exact', 'manual'),
('สำนักงานสถิติแห่งชาติ', 'data', 'govdata', 'th', 0.95, 'high', 'exact', 'manual'),
('ข้อมูลประชากร', 'data', 'govdata', 'th', 0.90, 'medium', 'exact', 'manual'),
('ข้อมูลเศรษฐกิจ', 'data', 'govdata', 'th', 0.90, 'medium', 'exact', 'manual'),

-- Archive Keywords
('archive', 'data', 'archive', 'en', 1.00, 'critical', 'exact', 'manual'),
('คลังข้อมูล', 'data', 'archive', 'th', 0.95, 'high', 'exact', 'manual'),
('ประวัติศาสตร์', 'data', 'archive', 'th', 0.85, 'medium', 'exact', 'manual'),
('เอกสารเก่า', 'data', 'archive', 'th', 0.85, 'medium', 'exact', 'manual'),

-- Newton Keywords
('newton', 'data', 'newton', 'en', 1.00, 'critical', 'exact', 'manual'),
('ฟิสิกส์', 'data', 'newton', 'th', 0.95, 'high', 'exact', 'manual'),
('แรง', 'data', 'newton', 'th', 0.85, 'medium', 'exact', 'manual'),
('ความเร็ว', 'data', 'newton', 'th', 0.85, 'medium', 'exact', 'manual'),
('พลังงาน', 'data', 'newton', 'th', 0.85, 'medium', 'exact', 'manual'),

-- ================================
-- CALCULATOR CATEGORY
-- ================================
('คำนวณ', 'calculator', 'math', 'th', 1.00, 'critical', 'exact', 'manual'),
('บวก', 'calculator', 'math', 'th', 0.90, 'high', 'exact', 'manual'),
('ลบ', 'calculator', 'math', 'th', 0.90, 'high', 'exact', 'manual'),
('คูณ', 'calculator', 'math', 'th', 0.90, 'high', 'exact', 'manual'),
('หาร', 'calculator', 'math', 'th', 0.90, 'high', 'exact', 'manual'),
('ยกกำลัง', 'calculator', 'math', 'th', 0.85, 'medium', 'exact', 'manual'),
('รากที่สอง', 'calculator', 'math', 'th', 0.85, 'medium', 'exact', 'exact', 'manual'),
('แฟกทอเรียล', 'calculator', 'math', 'th', 0.90, 'high', 'exact', 'manual'),
('factorial', 'calculator', 'math', 'en', 0.90, 'high', 'exact', 'manual'),
('sin', 'calculator', 'math', 'en', 0.85, 'medium', 'exact', 'manual'),
('cos', 'calculator', 'math', 'en', 0.85, 'medium', 'exact', 'manual'),
('tan', 'calculator', 'math', 'en', 0.85, 'medium', 'exact', 'manual'),
('log', 'calculator', 'math', 'en', 0.85, 'medium', 'exact', 'manual'),

-- ================================
-- DATETIME CATEGORY
-- ================================
('วันนี้', 'datetime', 'time', 'th', 0.90, 'high', 'exact', 'manual'),
('พรุ่งนี้', 'datetime', 'time', 'th', 0.90, 'high', 'exact', 'manual'),
('เมื่อวาน', 'datetime', 'time', 'th', 0.90, 'high', 'exact', 'manual'),
('เวลา', 'datetime', 'time', 'th', 0.90, 'high', 'exact', 'manual'),
('วันที่', 'datetime', 'time', 'th', 0.85, 'medium', 'exact', 'manual'),
('เดือน', 'datetime', 'time', 'th', 0.85, 'medium', 'exact', 'manual'),
('ปี', 'datetime', 'time', 'th', 0.85, 'medium', 'exact', 'manual'),
('timezone', 'datetime', 'time', 'en', 0.90, 'medium', 'exact', 'manual'),
('utc', 'datetime', 'time', 'en', 0.85, 'medium', 'exact', 'manual'),
('gmt', 'datetime', 'time', 'en', 0.85, 'medium', 'exact', 'manual'),

-- ================================
-- TRANSLATION CATEGORY
-- ================================
('แปล', 'translation', 'language', 'th', 1.00, 'critical', 'exact', 'manual'),
('translate', 'translation', 'language', 'en', 1.00, 'critical', 'exact', 'manual'),
('ภาษาอังกฤษ', 'translation', 'language', 'th', 0.90, 'high', 'exact', 'manual'),
('ภาษาไทย', 'translation', 'language', 'th', 0.90, 'high', 'exact', 'manual'),
('ภาษาจีน', 'translation', 'language', 'th', 0.85, 'medium', 'exact', 'manual'),
('ภาษาญี่ปุ่น', 'translation', 'language', 'th', 0.85, 'medium', 'exact', 'manual'),
('ภาษาเกาหลี', 'translation', 'language', 'th', 0.85, 'medium', 'exact', 'manual'),

-- ================================
-- QRCODE CATEGORY
-- ================================
('qrcode', 'qrcode', 'qr', 'en', 1.00, 'critical', 'exact', 'exact', 'manual'),
('qr', 'qrcode', 'qr', 'en', 0.90, 'high', 'exact', 'manual'),
('สร้าง qr', 'qrcode', 'qr', 'th', 0.90, 'high', 'exact', 'manual'),
('qr code', 'qrcode', 'qr', 'en', 0.95, 'high', 'exact', 'manual'),
('คิวอาร์โค้ด', 'qrcode', 'qr', 'th', 0.95, 'high', 'exact', 'manual'),

-- ================================
-- OCR CATEGORY
-- ================================
('ocr', 'ocr', 'text-recognition', 'en', 1.00, 'critical', 'exact', 'manual'),
('อ่านข้อความจากภาพ', 'ocr', 'text-recognition', 'th', 0.95, 'high', 'exact', 'manual'),
('อ่านภาพ', 'ocr', 'text-recognition', 'th', 0.90, 'high', 'exact', 'manual'),
('ocr ภาพ', 'ocr', 'text-recognition', 'th', 0.90, 'high', 'exact', 'manual'),
('แยกข้อความ', 'ocr', 'text-recognition', 'th', 0.85, 'medium', 'exact', 'manual'),

-- ================================
-- VISUALIZATION CATEGORY
-- ================================
('กราฟ', 'visualization', 'charts', 'th', 1.00, 'critical', 'exact', 'manual'),
('แผนภูมิ', 'visualization', 'charts', 'th', 0.95, 'high', 'exact', 'manual'),
('echarts', 'visualization', 'charts', 'en', 0.90, 'high', 'exact', 'manual'),
('chart', 'visualization', 'charts', 'en', 0.90, 'high', 'exact', 'manual'),
('กราฟแท่ง', 'visualization', 'charts', 'th', 0.85, 'medium', 'exact', 'manual'),
('กราฟวงกลม', 'visualization', 'charts', 'th', 0.85, 'medium', 'exact', 'manual'),
('กราฟเส้น', 'visualization', 'charts', 'th', 0.85, 'medium', 'exact', 'manual'),

-- ================================
-- FILES CATEGORY
-- ================================
('pdf', 'files', 'documents', 'en', 1.00, 'critical', 'exact', 'manual'),
('excel', 'files', 'spreadsheets', 'en', 1.00, 'critical', 'exact', 'manual'),
('word', 'files', 'documents', 'en', 1.00, 'critical', 'exact', 'manual'),
('อ่านไฟล์', 'files', 'documents', 'th', 0.90, 'high', 'exact', 'manual'),
('เปิดเอกสาร', 'files', 'documents', 'th', 0.85, 'medium', 'exact', 'manual'),
('แยกข้อความจากไฟล์', 'files', 'documents', 'th', 0.85, 'medium', 'exact', 'manual'),
('xlsx', 'files', 'spreadsheets', 'en', 0.95, 'high', 'exact', 'manual'),
('docx', 'files', 'documents', 'en', 0.95, 'high', 'exact', 'manual'),

-- ================================
-- IMAGE GENERATOR CATEGORY
-- ================================
('สร้างภาพ', 'image-generator', 'ai-art', 'th', 1.00, 'critical', 'exact', 'manual'),
('generate image', 'image-generator', 'ai-art', 'en', 1.00, 'critical', 'exact', 'manual'),
('ai ภาพ', 'image-generator', 'ai-art', 'th', 0.90, 'high', 'exact', 'manual'),
('วาดภาพ', 'image-generator', 'ai-art', 'th', 0.85, 'medium', 'exact', 'manual'),
('canvas', 'image-generator', 'ai-art', 'en', 0.85, 'medium', 'exact', 'manual'),

-- ================================
-- CURRENCY EXCHANGE CATEGORY
-- ================================
('แลกเปลี่ยนเงินตรา', 'currency-exchange', 'finance', 'th', 1.00, 'critical', 'exact', 'manual'),
('อัตราแลกเปลี่ยน', 'currency-exchange', 'finance', 'th', 0.95, 'high', 'exact', 'manual'),
('usd', 'currency-exchange', 'finance', 'en', 0.90, 'high', 'exact', 'manual'),
('eur', 'currency-exchange', 'finance', 'en', 0.90, 'high', 'exact', 'manual'),
('jpy', 'currency-exchange', 'finance', 'en', 0.85, 'medium', 'exact', 'manual'),
('gbp', 'currency-exchange', 'finance', 'en', 0.85, 'medium', 'exact', 'manual'),
('thb', 'currency-exchange', 'finance', 'en', 0.90, 'high', 'exact', 'manual'),

-- ================================
-- RSS FEED CATEGORY
-- ================================
('rss', 'rss-feed', 'news', 'en', 1.00, 'critical', 'exact', 'manual'),
('ข่าว', 'rss-feed', 'news', 'th', 0.90, 'high', 'exact', 'manual'),
('ฟีดข่าว', 'rss-feed', 'news', 'th', 0.90, 'high', 'exact', 'manual'),
('ข่าวสาร', 'rss-feed', 'news', 'th', 0.85, 'medium', 'exact', 'manual'),

-- ================================
-- CODE FORMATTER CATEGORY
-- ================================
('format code', 'code-formatter', 'development', 'en', 1.00, 'critical', 'exact', 'manual'),
('จัดรูปแบบโค้ด', 'code-formatter', 'development', 'th', 0.95, 'high', 'exact', 'manual'),
('beautify', 'code-formatter', 'development', 'en', 0.90, 'high', 'exact', 'manual'),
('javascript', 'code-formatter', 'development', 'en', 0.85, 'medium', 'exact', 'manual'),
('typescript', 'code-formatter', 'development', 'en', 0.85, 'medium', 'exact', 'manual'),
('python', 'code-formatter', 'development', 'en', 0.85, 'medium', 'exact', 'manual'),

-- ================================
-- GENERAL CATEGORY (Fallback)
-- ================================
('ช่วย', 'general', 'help', 'th', 0.80, 'low', 'exact', 'manual'),
('อะไร', 'general', 'help', 'th', 0.80, 'low', 'exact', 'manual'),
('how', 'general', 'help', 'en', 0.80, 'low', 'exact', 'manual'),
('what', 'general', 'help', 'en', 0.80, 'low', 'exact', 'manual'),
('ช่วยเหลือ', 'general', 'help', 'th', 0.85, 'low', 'exact', 'manual'),
('สอบถาม', 'general', 'help', 'th', 0.80, 'low', 'exact', 'manual')

ON DUPLICATE KEY UPDATE
  confidence_score = GREATEST(confidence_score, VALUES(confidence_score)),
  priority_level = VALUES(priority_level),
  subcategory = VALUES(subcategory),
  language = VALUES(language),
  last_used = CURRENT_TIMESTAMP,
  use_count = use_count + 1;

-- Restore settings
SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

-- Show summary
SELECT
  category,
  subcategory,
  COUNT(*) as keyword_count,
  AVG(confidence_score) as avg_confidence,
  GROUP_CONCAT(DISTINCT priority_level ORDER BY priority_level DESC) as priority_levels
FROM keyword_training
GROUP BY category, subcategory
ORDER BY category, subcategory;