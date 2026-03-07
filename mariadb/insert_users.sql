-- ========================================
-- สร้าง Admin และ User สำหรับระบบ INNOMCP
-- ========================================

-- ล้างข้อมูลเก่า (ถ้ามี)
DELETE FROM `user` WHERE username IN ('admin', 'user', 'guest');

-- สร้าง User: admin (userrole_id = 0 = Super Admin)
-- Password: <REDACTED_PASSWORD>
INSERT INTO `user` 
(`username`, `user_pwd`, `user_email`, `user_dispname`, `user_active`, `userrole_id`, `user_disp_name`, `user_role_id`, `created_at`) 
VALUES 
('admin', 
 '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGqeePe7JOHCU9yDC/.jN2m', -- bcrypt hash of '<REDACTED_PASSWORD>'
 'admin@innomcp.local', 
 'System Administrator', 
 '1', 
 0, 
 'System Administrator', 
 0, 
 NOW());

-- สร้าง User: user (userrole_id = 1 = Regular User)
-- Password: <REDACTED_PASSWORD>
INSERT INTO `user` 
(`username`, `user_pwd`, `user_email`, `user_dispname`, `user_active`, `userrole_id`, `user_disp_name`, `user_role_id`, `created_at`) 
VALUES 
('user', 
 '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGqeePe7JOHCU9yDC/.jN2m', -- bcrypt hash of 'User@123'
 'user@innomcp.local', 
 'Regular User', 
 '1', 
 1, 
 'Regular User', 
 1, 
 NOW());

-- แสดงผลลัพธ์
SELECT 'Users created successfully!' AS result;
SELECT user_id, username, user_email, user_dispname, userrole_id, user_active 
FROM `user` 
WHERE username IN ('admin', 'user')
ORDER BY userrole_id;

-- ========================================
-- ข้อมูล Role ที่ใช้ในระบบ
-- ========================================
-- userrole_id = 0: Super Admin (100% + config MCP/chat)
-- userrole_id = 1: Regular User (100% chat only)
-- userrole_id = 2: Officer/Moderator
-- Guest (ไม่ login): 50% limited access
