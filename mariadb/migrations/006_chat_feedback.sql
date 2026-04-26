-- mariadb/migrations/006_chat_feedback.sql
-- Phase 5: persist user up/down feedback on chat messages.
-- The Next.js feedback route still writes JSONL for tail-able logs;
-- this table powers the admin dashboard's aggregate views.
CREATE TABLE IF NOT EXISTS chat_feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id VARCHAR(64) DEFAULT NULL,
  session_id VARCHAR(64) DEFAULT NULL,
  rating ENUM('up','down') NOT NULL,
  user_id INT DEFAULT NULL,
  query TEXT,
  response_summary TEXT,
  route VARCHAR(64) DEFAULT NULL,
  tools_used VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rating (rating),
  INDEX idx_created_at (created_at),
  INDEX idx_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
