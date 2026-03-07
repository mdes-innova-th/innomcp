-- mariadb/migrations/005_knowledge_entities.sql
CREATE TABLE IF NOT EXISTS knowledge_entities (
  id VARCHAR(50) NOT NULL,
  domain VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL,
  name_th VARCHAR(255) NOT NULL,
  aliases JSON DEFAULT NULL,
  description TEXT,
  attributes JSON DEFAULT NULL,
  relations JSON DEFAULT NULL,
  source JSON DEFAULT NULL,
  confidence FLOAT NOT NULL DEFAULT 0,
  version VARCHAR(20) DEFAULT '1.0.0',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ke_domain (domain),
  KEY idx_ke_type (type),
  FULLTEXT KEY idx_ke_fts (name_th, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
