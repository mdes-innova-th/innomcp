-- Migration 04: Feedback (star ratings) for chat messages
-- Run after 02-tasks.sql

CREATE TABLE IF NOT EXISTS feedback (
  id          INT           NOT NULL AUTO_INCREMENT,
  message_id  VARCHAR(64)   NOT NULL,
  rating      TINYINT       NOT NULL,
  session_id  VARCHAR(64)   NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 5),
  INDEX idx_feedback_message (message_id),
  INDEX idx_feedback_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
