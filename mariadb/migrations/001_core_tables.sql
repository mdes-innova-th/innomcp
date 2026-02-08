-- 001_core_tables.sql
-- Safe / Idempotent: run many timesได้

CREATE DATABASE IF NOT EXISTS innomcp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE innomcp;

-- =========
-- user_activity_log
-- (รองรับ insert ใน log ของคุณ: action_type, action_detail, ip_address, user_agent, status, created_at)
-- =========
CREATE TABLE IF NOT EXISTS user_activity_log (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NULL,
  action_type VARCHAR(50) NOT NULL,
  action_detail TEXT NULL,
  ip_address VARCHAR(64) NULL,
  user_agent TEXT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_u_log_created_at (created_at),
  KEY idx_u_log_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========
-- user_sessions (minimal schema for auth/login)
-- =========
CREATE TABLE IF NOT EXISTS user_sessions (
  session_id VARCHAR(255) NOT NULL,
  user_id INT(11) NOT NULL,
  device_info JSON DEFAULT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id),
  KEY idx_session_user (user_id),
  KEY idx_session_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========
-- Seed required test accounts (idempotent)
-- Password for all below: Admin@123
-- =========
SET @ADMIN_123_HASH := '$2b$10$xmpyehSvBIjLzBnxuxUCFuPCguRyoKLMfFdCxFRrnHQk1CFf.N5J.';

INSERT INTO `user`
  (username, password, user_pwd, user_email, user_dispname, user_disp_name, user_active, userrole_id, user_role_id, created_at, updated_at)
VALUES
  ('lb2rock', @ADMIN_123_HASH, @ADMIN_123_HASH, 'lb2rock@gmail.com', 'Administrator', 'Administrator', '1', 1, 1, NOW(), NOW()),
  ('jaran.l', @ADMIN_123_HASH, @ADMIN_123_HASH, 'jaran.x@gmail.com', 'Jaran Laothong', 'Jaran Laothong', '1', 1, 1, NOW(), NOW()),
  ('officer', @ADMIN_123_HASH, @ADMIN_123_HASH, 'officer@gmail.com', 'ผู้ตรวจสอบ', 'ผู้ตรวจสอบ', '1', 2, 2, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  password = VALUES(password),
  user_pwd = VALUES(user_pwd),
  user_email = VALUES(user_email),
  user_dispname = VALUES(user_dispname),
  user_disp_name = VALUES(user_disp_name),
  user_active = VALUES(user_active),
  userrole_id = VALUES(userrole_id),
  user_role_id = VALUES(user_role_id),
  updated_at = NOW();

-- ถ้าคุณมีตาราง keyword ฯลฯ ให้ทำแนวเดียวกัน:
-- CREATE TABLE IF NOT EXISTS ...
-- INSERT IGNORE ... (seed)
