-- ========================================
-- อัปเดต Password สำหรับ Admin และ User
-- ========================================

USE `innomcp-db`;

-- อัปเดต password สำหรับ admin (lb2rock@gmail.com)
-- Password: Admin@123
UPDATE `user` 
SET `password` = '$2b$10$xmpyehSvBIjLzBnxuxUCFuPCguRyoKLMfFdCxFRrnHQk1CFf.N5J.'
WHERE user_email = 'lb2rock@gmail.com';

-- อัปเดต password สำหรับ admin (jaran.x@gmail.com)
-- Password: Admin@123
UPDATE `user` 
SET `password` = '$2b$10$xmpyehSvBIjLzBnxuxUCFuPCguRyoKLMfFdCxFRrnHQk1CFf.N5J.'
WHERE user_email = 'jaran.x@gmail.com';

-- อัปเดต password สำหรับ officer
-- Password: Admin@123
UPDATE `user` 
SET `password` = '$2b$10$xmpyehSvBIjLzBnxuxUCFuPCguRyoKLMfFdCxFRrnHQk1CFf.N5J.'
WHERE user_email = 'officer@gmail.com';

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
WHERE user_email IN ('lb2rock@gmail.com', 'jaran.x@gmail.com', 'officer@gmail.com', 'user@innomcp.local')
ORDER BY userrole_id;

-- ========================================
-- คำแนะนำการ Login
-- ========================================
-- Admin Users:
--   lb2rock@gmail.com / Admin@123
--   jaran.x@gmail.com / Admin@123
--   officer@gmail.com / Admin@123
-- 
-- Regular User:
--   user@innomcp.local / User@123
-- ========================================
