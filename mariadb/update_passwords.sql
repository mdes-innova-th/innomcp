-- ========================================
-- อัปเดต Password สำหรับ Admin และ User
-- ========================================

USE `innomcp-db`;

-- อัปเดต password สำหรับ admin (admin@example.local)
-- Password: <REDACTED_PASSWORD>
UPDATE `user` 
SET `password` = '$2b$10$xmpyehSvBIjLzBnxuxUCFuPCguRyoKLMfFdCxFRrnHQk1CFf.N5J.'
WHERE user_email = 'admin@example.local';

-- อัปเดต password สำหรับ admin (user@example.local)
-- Password: <REDACTED_PASSWORD>
UPDATE `user` 
SET `password` = '$2b$10$xmpyehSvBIjLzBnxuxUCFuPCguRyoKLMfFdCxFRrnHQk1CFf.N5J.'
WHERE user_email = 'user@example.local';

-- อัปเดต password สำหรับ officer
-- Password: <REDACTED_PASSWORD>
UPDATE `user` 
SET `password` = '$2b$10$xmpyehSvBIjLzBnxuxUCFuPCguRyoKLMfFdCxFRrnHQk1CFf.N5J.'
WHERE user_email = 'officer@example.local';

-- สร้าง user ทดสอบ (ถ้ายังไม่มี)
INSERT IGNORE INTO `user` 
(`username`, `password`, `user_email`, `user_dispname`, `user_active`, `userrole_id`, `created_at`) 
VALUES 
('testuser', 
 '$2b$10$g6Ai9bD9scN2r9bG0rydje0C2frMa0RWfT/PaHUMoVMAsvt5PL5xW',
 'user@innomcp.local', 
 'Test User',
 '1', 
 1,
 NOW());

-- แสดงผลลัพธ์
SELECT 'Passwords updated successfully!' AS result;
SELECT user_id, username, user_email, user_dispname, userrole_id, user_role_id
FROM `user` 
WHERE user_email IN ('admin@example.local', 'user@example.local', 'officer@example.local', 'user@innomcp.local')
ORDER BY userrole_id;

-- ========================================
-- คำแนะนำการ Login
-- ========================================
-- Admin Users:
--   admin@example.local / <REDACTED_PASSWORD>
--   user@example.local / <REDACTED_PASSWORD>
--   officer@example.local / <REDACTED_PASSWORD>
-- 
-- Regular User:
--   user@innomcp.local / <REDACTED_PASSWORD>
-- ========================================
