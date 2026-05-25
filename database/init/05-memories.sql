-- Migration 05: Project Memory (key-value store per session/project/user)
-- Run after 04-feedback.sql

CREATE TABLE IF NOT EXISTS memories (
  id           INT          AUTO_INCREMENT PRIMARY KEY,
  project_id   VARCHAR(64)  NULL,
  session_id   VARCHAR(64)  NULL,
  scope        VARCHAR(32)  NOT NULL DEFAULT 'session',
  key_name     VARCHAR(128) NOT NULL,
  value        TEXT         NOT NULL,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_project (project_id),
  INDEX idx_session (session_id),
  INDEX idx_scope_key (scope, key_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
