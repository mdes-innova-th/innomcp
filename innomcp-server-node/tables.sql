-- 2026-02-07: Added knowledge_entities for Thai Knowledge Layer (Phase 1 GEO)

CREATE TABLE IF NOT EXISTS `knowledge_entities` (
  `id` VARCHAR(64) NOT NULL, -- UUID or unique string
  `domain` VARCHAR(50) NOT NULL COMMENT 'geo, law, history, religion, education',
  `type` VARCHAR(64) NOT NULL DEFAULT 'unknown' COMMENT 'Sub-type in each domain (province, law, temple, etc.)',
  `name_th` VARCHAR(255) NOT NULL,
  `aliases` JSON DEFAULT NULL COMMENT 'Array of strings',
  `description` TEXT,
  `attributes` JSON DEFAULT NULL COMMENT 'Domain specific attributes (e.g. lat/lon for geo)',
  `relations` JSON DEFAULT NULL,
  `source` JSON DEFAULT NULL COMMENT 'Array of source objects [{name, url}]',
  `confidence` DECIMAL(3,2) DEFAULT 1.00,
  `version` VARCHAR(20) DEFAULT '1.0.0',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_domain` (`domain`),
  FULLTEXT KEY `idx_ft_name_desc` (`name_th`, `description`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
