CREATE TABLE IF NOT EXISTS `knowledge_entities` (
  `id` VARCHAR(64) NOT NULL,
  `domain` VARCHAR(50) NOT NULL COMMENT 'geo, law, history, religion, education',
  `type` VARCHAR(64) NOT NULL COMMENT 'province, district, subdistrict, law, temple, etc.',
  `name_th` VARCHAR(255) NOT NULL,
  `aliases` JSON DEFAULT NULL COMMENT 'Array of alias names',
  `description` TEXT,
  `attributes` JSON DEFAULT NULL COMMENT 'Domain-specific attributes (region, lat, lon, ...)',
  `relations` JSON DEFAULT NULL COMMENT 'Relation map to other entities',
  `source` JSON DEFAULT NULL COMMENT 'Array of source objects [{name,url}]',
  `confidence` DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  `version` VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_domain` (`domain`),
  FULLTEXT KEY `idx_ft_name_desc` (`name_th`, `description`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
