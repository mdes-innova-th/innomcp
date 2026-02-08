-- ============================================================================
-- INNOMCP User Workspace & Personalization System
-- ============================================================================
-- Database: innomcp-db
-- Created: 2026-01-06
-- Description: Enhanced user workspace management, personalization, and auth
-- ============================================================================

USE `innomcp-db`;

-- ============================================================================
-- 1. WORKSPACE MANAGEMENT
-- ============================================================================

-- User Workspaces
-- Each user can have multiple workspaces with custom settings
CREATE TABLE IF NOT EXISTS `user_workspaces` (
  `workspace_id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL,
  `workspace_name` VARCHAR(100) NOT NULL DEFAULT 'My Workspace',
  `workspace_slug` VARCHAR(100) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `is_default` TINYINT(1) DEFAULT 0,
  `is_active` TINYINT(1) DEFAULT 1,
  `storage_path` VARCHAR(255) NOT NULL,
  `storage_quota_mb` INT(11) DEFAULT 1000,
  `storage_used_mb` DECIMAL(10,2) DEFAULT 0.00,
  `theme` ENUM('light', 'dark', 'auto') DEFAULT 'auto',
  `color_scheme` VARCHAR(50) DEFAULT 'default',
  `language` VARCHAR(10) DEFAULT 'th',
  `timezone` VARCHAR(50) DEFAULT 'Asia/Bangkok',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`workspace_id`),
  UNIQUE KEY `unique_slug_per_user` (`user_id`, `workspace_slug`),
  KEY `idx_user_workspace` (`user_id`, `is_active`),
  KEY `idx_workspace_slug` (`workspace_slug`),
  CONSTRAINT `fk_workspace_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Workspace Custom Instructions
-- User-defined AI behavior for each workspace
CREATE TABLE IF NOT EXISTS `workspace_instructions` (
  `instruction_id` INT(11) NOT NULL AUTO_INCREMENT,
  `workspace_id` INT(11) NOT NULL,
  `instruction_type` ENUM('system', 'personality', 'behavior', 'constraint') DEFAULT 'system',
  `instruction_text` TEXT NOT NULL,
  `priority` INT(3) DEFAULT 100,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`instruction_id`),
  KEY `idx_workspace_instructions` (`workspace_id`, `is_active`, `priority`),
  CONSTRAINT `fk_instruction_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `user_workspaces` (`workspace_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. USER PERSONALIZATION
-- ============================================================================

-- User Profile Details (Extended)
CREATE TABLE IF NOT EXISTS `user_profiles` (
  `profile_id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL,
  `nickname` VARCHAR(50) DEFAULT NULL,
  `occupation` VARCHAR(100) DEFAULT NULL,
  `about_me` TEXT DEFAULT NULL,
  `interests` JSON DEFAULT NULL COMMENT 'Array of user interests',
  `expertise` JSON DEFAULT NULL COMMENT 'Array of areas of expertise',
  `preferred_language` VARCHAR(10) DEFAULT 'th',
  `communication_style` ENUM('formal', 'casual', 'professional', 'friendly') DEFAULT 'professional',
  `response_length` ENUM('concise', 'balanced', 'detailed') DEFAULT 'balanced',
  `avatar_url` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`profile_id`),
  UNIQUE KEY `unique_user_profile` (`user_id`),
  CONSTRAINT `fk_profile_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User AI Memory System
-- Long-term memory for personalized interactions
CREATE TABLE IF NOT EXISTS `user_memory` (
  `memory_id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL,
  `workspace_id` INT(11) DEFAULT NULL COMMENT 'NULL = global memory',
  `memory_type` ENUM('fact', 'preference', 'context', 'relationship') DEFAULT 'fact',
  `memory_key` VARCHAR(100) NOT NULL COMMENT 'e.g., favorite_color, preferred_format',
  `memory_value` TEXT NOT NULL,
  `confidence` DECIMAL(3,2) DEFAULT 1.00 COMMENT '0.00-1.00 confidence score',
  `source` ENUM('user_stated', 'ai_inferred', 'admin_set') DEFAULT 'user_stated',
  `last_accessed` TIMESTAMP NULL DEFAULT NULL,
  `access_count` INT(11) DEFAULT 0,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`memory_id`),
  KEY `idx_user_memory` (`user_id`, `is_active`),
  KEY `idx_memory_workspace` (`workspace_id`),
  KEY `idx_memory_key` (`memory_key`),
  CONSTRAINT `fk_memory_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_memory_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `user_workspaces` (`workspace_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Custom Characteristics (AI Persona)
CREATE TABLE IF NOT EXISTS `user_characteristics` (
  `characteristic_id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL,
  `characteristic_name` VARCHAR(50) NOT NULL COMMENT 'e.g., tone, formality, humor',
  `characteristic_value` VARCHAR(100) NOT NULL COMMENT 'e.g., friendly, formal, witty',
  `description` TEXT DEFAULT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`characteristic_id`),
  KEY `idx_user_characteristics` (`user_id`, `is_active`),
  CONSTRAINT `fk_characteristic_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. ENHANCED AUTHENTICATION
-- ============================================================================

-- OAuth Providers (Thai ID, Google, etc.)
CREATE TABLE IF NOT EXISTS `oauth_providers` (
  `provider_id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL,
  `provider_name` ENUM('thaid', 'google', 'facebook', 'line') NOT NULL,
  `provider_user_id` VARCHAR(255) NOT NULL,
  `access_token` TEXT DEFAULT NULL,
  `refresh_token` TEXT DEFAULT NULL,
  `token_expires_at` TIMESTAMP NULL DEFAULT NULL,
  `profile_data` JSON DEFAULT NULL COMMENT 'Provider profile info',
  `is_verified` TINYINT(1) DEFAULT 0,
  `is_primary` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`provider_id`),
  UNIQUE KEY `unique_provider_user` (`provider_name`, `provider_user_id`),
  KEY `idx_oauth_user` (`user_id`),
  CONSTRAINT `fk_oauth_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Password Reset Tokens
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `token_id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `is_used` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`token_id`),
  UNIQUE KEY `unique_token` (`token`),
  KEY `idx_reset_token_user` (`user_id`),
  KEY `idx_reset_token_expiry` (`expires_at`, `is_used`),
  CONSTRAINT `fk_reset_token_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Sessions (Enhanced)
CREATE TABLE IF NOT EXISTS `user_sessions` (
  `session_id` VARCHAR(255) NOT NULL,
  `user_id` INT(11) NOT NULL,
  `workspace_id` INT(11) DEFAULT NULL,
  `device_info` JSON DEFAULT NULL COMMENT 'Browser, OS, IP, etc.',
  `session_data` JSON DEFAULT NULL COMMENT 'Custom session data',
  `last_activity` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `expires_at` TIMESTAMP NOT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`session_id`),
  KEY `idx_session_user` (`user_id`, `is_active`),
  KEY `idx_session_workspace` (`workspace_id`),
  KEY `idx_session_expiry` (`expires_at`),
  CONSTRAINT `fk_session_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_session_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `user_workspaces` (`workspace_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. CHAT HISTORY & CONTEXT
-- ============================================================================

-- Chat Conversations
CREATE TABLE IF NOT EXISTS `chat_conversations` (
  `conversation_id` VARCHAR(255) NOT NULL,
  `user_id` INT(11) NOT NULL,
  `workspace_id` INT(11) NOT NULL,
  `title` VARCHAR(255) DEFAULT 'New Chat',
  `summary` TEXT DEFAULT NULL,
  `message_count` INT(11) DEFAULT 0,
  `last_message_at` TIMESTAMP NULL DEFAULT NULL,
  `is_pinned` TINYINT(1) DEFAULT 0,
  `is_archived` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`conversation_id`),
  KEY `idx_conversation_user` (`user_id`, `is_archived`, `last_message_at`),
  KEY `idx_conversation_workspace` (`workspace_id`),
  CONSTRAINT `fk_conversation_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_conversation_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `user_workspaces` (`workspace_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chat Messages
CREATE TABLE IF NOT EXISTS `chat_messages` (
  `message_id` BIGINT(20) NOT NULL AUTO_INCREMENT,
  `conversation_id` VARCHAR(255) NOT NULL,
  `sender` ENUM('user', 'ai') NOT NULL,
  `message_text` TEXT NOT NULL,
  `structured_content` JSON DEFAULT NULL COMMENT 'Charts, images, etc.',
  `tools_used` JSON DEFAULT NULL COMMENT 'Array of MCP tools used',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`message_id`),
  KEY `idx_message_conversation` (`conversation_id`, `created_at`),
  CONSTRAINT `fk_message_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations` (`conversation_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. USER FILES & UPLOADS
-- ============================================================================

-- User Files Metadata
CREATE TABLE IF NOT EXISTS `user_files` (
  `file_id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL,
  `workspace_id` INT(11) NOT NULL,
  `filename` VARCHAR(255) NOT NULL,
  `original_filename` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `file_size_bytes` BIGINT(20) NOT NULL,
  `mime_type` VARCHAR(100) DEFAULT NULL,
  `file_type` ENUM('document', 'image', 'video', 'audio', 'other') DEFAULT 'other',
  `is_public` TINYINT(1) DEFAULT 0,
  `download_count` INT(11) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`file_id`),
  KEY `idx_file_user` (`user_id`),
  KEY `idx_file_workspace` (`workspace_id`),
  KEY `idx_file_type` (`file_type`),
  CONSTRAINT `fk_file_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_file_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `user_workspaces` (`workspace_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. SYSTEM SETTINGS & PREFERENCES
-- ============================================================================

-- User Preferences
CREATE TABLE IF NOT EXISTS `user_preferences` (
  `preference_id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL,
  `workspace_id` INT(11) DEFAULT NULL COMMENT 'NULL = global preference',
  `preference_key` VARCHAR(100) NOT NULL,
  `preference_value` TEXT NOT NULL,
  `value_type` ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
  `category` VARCHAR(50) DEFAULT 'general' COMMENT 'ui, ai, notification, etc.',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`preference_id`),
  UNIQUE KEY `unique_user_workspace_key` (`user_id`, `workspace_id`, `preference_key`),
  KEY `idx_preference_category` (`category`),
  CONSTRAINT `fk_preference_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_preference_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `user_workspaces` (`workspace_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. AUDIT LOG
-- ============================================================================

-- User Activity Log
CREATE TABLE IF NOT EXISTS `user_activity_log` (
  `log_id` BIGINT(20) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) DEFAULT NULL,
  `workspace_id` INT(11) DEFAULT NULL,
  `action_type` VARCHAR(50) NOT NULL COMMENT 'login, logout, file_upload, setting_change, etc.',
  `action_detail` TEXT DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `user_agent` TEXT DEFAULT NULL,
  `status` ENUM('success', 'failure', 'warning') DEFAULT 'success',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `idx_log_user` (`user_id`, `created_at`),
  KEY `idx_log_workspace` (`workspace_id`),
  KEY `idx_log_action` (`action_type`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 8. DEFAULT DATA & INDEXES
-- ============================================================================

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_email ON `user` (`user_email`);
CREATE INDEX IF NOT EXISTS idx_user_status ON `user` (`user_status`);

-- ============================================================================
-- COMPLETE
-- ============================================================================
