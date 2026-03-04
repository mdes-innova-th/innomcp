CREATE TABLE IF NOT EXISTS knowledge_entities (
  id VARCHAR(64) PRIMARY KEY,
  domain VARCHAR(32) NOT NULL,
  type VARCHAR(32) NOT NULL,
  name_th VARCHAR(255) NOT NULL,
  aliases JSON NULL,
  description TEXT NULL,
  attributes JSON NULL,
  relations JSON NULL,
  source JSON NULL,
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.80,
  version VARCHAR(32) NOT NULL DEFAULT 'v1',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FULLTEXT KEY idx_knowledge_name_th (name_th)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
