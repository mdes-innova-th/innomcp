-- mariadb/migrations/007_admin_audit_log.sql
-- Phase 3: persist admin POST/PATCH actions for accountability.
-- Recorded by innomcp-node admin endpoints (role change, active toggle).
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_user_id INT NOT NULL,
  action VARCHAR(64) NOT NULL,
  target_user_id INT DEFAULT NULL,
  meta JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin (admin_user_id),
  INDEX idx_target (target_user_id),
  INDEX idx_action (action),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
