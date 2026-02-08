-- ================================
-- Keyword Training Database Schema
-- For INNOMCP God-Tier Context-Aware Intent Engine
-- ================================

-- 1. Keywords Master Table (คลังคำหลัก)
CREATE TABLE IF NOT EXISTS keyword_training (
  id INT AUTO_INCREMENT PRIMARY KEY,
  keyword VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL, -- weather, data, nasa, calculator, etc.
  subcategory VARCHAR(100), -- nwp, tmd, worldbank, etc.
  language ENUM('th', 'en', 'mixed') DEFAULT 'th',
  confidence_score DECIMAL(3,2) DEFAULT 1.00, -- 0.00-1.00
  priority_level ENUM('critical', 'high', 'medium', 'low') DEFAULT 'medium',
  match_type ENUM('exact', 'fuzzy', 'semantic') DEFAULT 'exact',
  created_by ENUM('manual', 'llm', 'user-feedback') DEFAULT 'manual',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP NULL,
  use_count INT DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 100.00, -- percentage
  INDEX idx_keyword (keyword),
  INDEX idx_category (category),
  INDEX idx_priority (priority_level),
  UNIQUE KEY uk_keyword_category (keyword, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Keyword Patterns (รูปแบบคำ - สำหรับ fuzzy matching)
CREATE TABLE IF NOT EXISTS keyword_patterns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  keyword_id INT NOT NULL,
  pattern VARCHAR(500) NOT NULL, -- regex or wildcard pattern
  weight DECIMAL(3,2) DEFAULT 1.00,
  FOREIGN KEY (keyword_id) REFERENCES keyword_training(id) ON DELETE CASCADE,
  INDEX idx_pattern (pattern(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Keyword Embeddings (vector ของคำ - สำหรับ semantic search)
CREATE TABLE IF NOT EXISTS keyword_embeddings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  keyword_id INT NOT NULL,
  embedding_model VARCHAR(100) NOT NULL, -- nomic-embed-text, etc.
  embedding BLOB NOT NULL, -- JSON array of float32
  dimension INT NOT NULL, -- 768, 384, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (keyword_id) REFERENCES keyword_training(id) ON DELETE CASCADE,
  INDEX idx_model (embedding_model)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Query Logs (บันทึกคำถามผู้ใช้ - สำหรับเทรน)
CREATE TABLE IF NOT EXISTS query_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  session_id VARCHAR(255),
  query_text TEXT NOT NULL,
  detected_category VARCHAR(100),
  detected_tool VARCHAR(100),
  ai_mode ENUM('local', 'remote', 'hybrid') DEFAULT 'remote',
  response_time_ms INT,
  success BOOLEAN DEFAULT TRUE,
  user_feedback ENUM('positive', 'negative', 'neutral') NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session (session_id),
  INDEX idx_category (detected_category),
  INDEX idx_created (created_at),
  INDEX idx_ai_mode (ai_mode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. A/B Test Results (เปรียบเทียบ Remote vs Hybrid mode)
CREATE TABLE IF NOT EXISTS ab_test_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  query_log_id INT NOT NULL,
  test_type ENUM('mode-comparison', 'keyword-match', 'router-accuracy') DEFAULT 'mode-comparison',
  variant_a VARCHAR(50) NOT NULL, -- 'remote', 'hybrid', etc.
  variant_b VARCHAR(50) NOT NULL,
  variant_a_time_ms INT,
  variant_b_time_ms INT,
  variant_a_result TEXT,
  variant_b_result TEXT,
  winner VARCHAR(50), -- which variant won
  confidence_delta DECIMAL(5,2), -- difference in confidence
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (query_log_id) REFERENCES query_logs(id) ON DELETE CASCADE,
  INDEX idx_test_type (test_type),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Ambiguity Cases (กรณีที่ Router ไม่แน่ใจ - ต้องใช้ LLM Judge)
CREATE TABLE IF NOT EXISTS ambiguity_cases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  query_log_id INT NOT NULL,
  top1_category VARCHAR(100),
  top1_score DECIMAL(5,4),
  top2_category VARCHAR(100),
  top2_score DECIMAL(5,4),
  score_gap DECIMAL(5,4), -- top1 - top2
  llm_judge_decision VARCHAR(100) NULL,
  llm_reasoning TEXT NULL,
  resolution_time_ms INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (query_log_id) REFERENCES query_logs(id) ON DELETE CASCADE,
  INDEX idx_score_gap (score_gap),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================
-- Initial Seed Data (NWP + TMD Weather Keywords)
-- ================================

INSERT INTO keyword_training (keyword, category, subcategory, language, confidence_score, priority_level, match_type, created_by) VALUES
-- NWP Critical Keywords (พยากรณ์อากาศ HPC)
('พยากรณ์', 'weather', 'nwp', 'th', 1.00, 'critical', 'exact', 'manual'),
('อากาศ', 'weather', 'nwp', 'th', 0.95, 'high', 'exact', 'manual'),
('สภาพอากาศ', 'weather', 'nwp', 'th', 1.00, 'critical', 'exact', 'manual'),
('รายวัน', 'weather', 'nwp', 'th', 0.90, 'high', 'exact', 'manual'),
('รายชั่วโมง', 'weather', 'nwp', 'th', 0.95, 'critical', 'exact', 'manual'),
('วันข้างหน้า', 'weather', 'nwp', 'th', 0.85, 'high', 'exact', 'manual'),
('ชม.ข้างหน้า', 'weather', 'nwp', 'th', 0.85, 'high', 'exact', 'manual'),
('อุณหภูมิ', 'weather', 'nwp', 'th', 0.90, 'high', 'exact', 'manual'),
('ฝน', 'weather', 'nwp', 'th', 0.90, 'high', 'exact', 'manual'),
('ปริมาณฝน', 'weather', 'nwp', 'th', 0.95, 'high', 'exact', 'manual'),

-- TMD Keywords (อุตุนิยมวิทยา)
('tmd', 'weather', 'tmd', 'en', 1.00, 'critical', 'exact', 'manual'),
('อุตุนิยมวิทยา', 'weather', 'tmd', 'th', 1.00, 'critical', 'exact', 'manual'),
('กรมอุตุนิยมวิทยา', 'weather', 'tmd', 'th', 1.00, 'critical', 'exact', 'manual'),
('คำเตือน', 'weather', 'tmd', 'th', 0.90, 'high', 'exact', 'manual'),
('พายุ', 'weather', 'tmd', 'th', 0.95, 'critical', 'exact', 'manual'),
('แผ่นดินไหว', 'weather', 'tmd', 'th', 0.95, 'critical', 'exact', 'manual'),
('สถานี', 'weather', 'tmd', 'th', 0.85, 'medium', 'exact', 'manual'),

-- General Weather Keywords (เชื่อมทั้ง NWP + TMD)
-- Note: 'อากาศ' already in nwp category, removed duplicate
('ภูมิภาค', 'weather', 'general', 'th', 0.85, 'high', 'exact', 'manual'),
('จังหวัด', 'weather', 'general', 'th', 0.85, 'high', 'exact', 'manual'),
('lat=', 'weather', 'general', 'mixed', 0.90, 'high', 'exact', 'manual'),
('lon=', 'weather', 'general', 'mixed', 0.90, 'high', 'exact', 'manual');

-- ================================
-- Views for Quick Access
-- ================================

CREATE OR REPLACE VIEW v_keyword_stats AS
SELECT 
  category,
  subcategory,
  COUNT(*) as keyword_count,
  AVG(confidence_score) as avg_confidence,
  AVG(success_rate) as avg_success_rate,
  SUM(use_count) as total_uses
FROM keyword_training
GROUP BY category, subcategory
ORDER BY total_uses DESC;

CREATE OR REPLACE VIEW v_recent_queries AS
SELECT 
  ql.id,
  ql.query_text,
  ql.detected_category,
  ql.ai_mode,
  ql.response_time_ms,
  ql.success,
  ql.created_at,
  ac.score_gap as ambiguity_gap
FROM query_logs ql
LEFT JOIN ambiguity_cases ac ON ql.id = ac.query_log_id
ORDER BY ql.created_at DESC
LIMIT 100;

-- ================================
-- Stored Procedures
-- ================================

DROP PROCEDURE IF EXISTS update_keyword_usage;
DROP PROCEDURE IF EXISTS get_top_keywords;

DELIMITER //

-- Update keyword usage stats
CREATE PROCEDURE update_keyword_usage(
  IN p_keyword VARCHAR(255),
  IN p_category VARCHAR(100),
  IN p_success BOOLEAN
)
BEGIN
  UPDATE keyword_training
  SET 
    use_count = use_count + 1,
    last_used = CURRENT_TIMESTAMP,
    success_rate = (
      (success_rate * use_count + IF(p_success, 100, 0)) / (use_count + 1)
    )
  WHERE keyword = p_keyword AND category = p_category;
END //

-- Get top keywords by category
CREATE PROCEDURE get_top_keywords(
  IN p_category VARCHAR(100),
  IN p_limit INT
)
BEGIN
  SELECT 
    keyword,
    confidence_score,
    priority_level,
    use_count,
    success_rate
  FROM keyword_training
  WHERE category = p_category
  ORDER BY 
    CASE priority_level
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
    END,
    confidence_score DESC,
    use_count DESC
  LIMIT p_limit;
END //

DELIMITER ;

-- ================================
-- Grant Permissions (ถ้าต้องการ uncomment)
-- ================================

-- NOTE: Comment out เพราะ GRANT ใช้เมื่อตาราง/procedure มีแล้วเท่านั้น
-- หลัง deploy schema แล้ว ถ้าต้องการ GRANT ให้รันคำสั่งเหล่านี้แยก:

-- GRANT SELECT, INSERT, UPDATE ON innomcp_db.keyword_training TO 'jlapps'@'%';
-- GRANT SELECT, INSERT, UPDATE ON innomcp_db.query_logs TO 'jlapps'@'%';
-- GRANT SELECT, INSERT ON innomcp_db.ab_test_results TO 'jlapps'@'%';
-- GRANT SELECT, INSERT ON innomcp_db.ambiguity_cases TO 'jlapps'@'%';
-- GRANT EXECUTE ON PROCEDURE innomcp_db.update_keyword_usage TO 'jlapps'@'%';
-- GRANT EXECUTE ON PROCEDURE innomcp_db.get_top_keywords TO 'jlapps'@'%';

-- ================================
-- Notes & Future Extensions
-- ================================

/*
TODO:
1. Keyword synonym table (พยากรณ์ = forecast = prediction)
2. Context history table (เก็บ conversation context)
3. User preference table (บาง user ชอบ NWP, บาง user ชอบ TMD)
4. Feedback training queue (keyword ที่ต้อง retrain)
5. Performance metrics dashboard (avg response time by category)
*/
