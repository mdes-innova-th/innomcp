USE innomcp;

-- 1) userrole ต้องมาก่อน
CREATE TABLE IF NOT EXISTS `userrole` (
  `userrole_id` int(11) NOT NULL AUTO_INCREMENT,
  `userrole_name` varchar(45) NOT NULL,
  `userrole_active` char(1) NOT NULL,
  PRIMARY KEY (`userrole_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_uca1400_ai_ci;

-- seed role เบื้องต้น (กัน FK fail)
INSERT IGNORE INTO `userrole` (`userrole_id`,`userrole_name`,`userrole_active`) VALUES
(0,'Administrator','1'),
(1,'User','1'),
(2,'Auditor','1');

-- 2) user (อ้างถึง userrole ได้แล้ว)
CREATE TABLE IF NOT EXISTS `user` (
  `user_id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(45) NOT NULL,
  `password` text DEFAULT NULL,
  `user_email` varchar(200) DEFAULT NULL,
  `user_dispname` varchar(100) NOT NULL COMMENT 'ชื่อของผู้ใช้',
  `user_birthdate` date DEFAULT NULL COMMENT 'วันเกิดของผู้ใช้',
  `user_active` char(1) NOT NULL,
  `reset_token` varchar(255) DEFAULT NULL,
  `reset_token_expire` datetime DEFAULT NULL,
  `userrole_id` int(11) NOT NULL,
  `user_phone` varchar(30) DEFAULT NULL,
  `user_pwd` text DEFAULT NULL COMMENT 'Password field for compatibility',
  `user_disp_name` varchar(100) DEFAULT NULL COMMENT 'Display name',
  `user_nickname` varchar(100) DEFAULT NULL COMMENT 'Nickname',
  `user_profile_image` varchar(255) DEFAULT NULL COMMENT 'Profile image URL',
  `user_role_id` int(11) DEFAULT NULL COMMENT 'User role ID for compatibility',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `user_id_UNIQUE` (`user_id`),
  UNIQUE KEY `username_UNIQUE` (`username`),
  UNIQUE KEY `user_email_UNIQUE` (`user_email`),
  KEY `fk_user_userrole1_idx` (`userrole_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_uca1400_ai_ci;

-- ใส่ FK ทีหลังแบบปลอดภัย (ถ้ามีอยู่แล้วจะ error → เลยจับด้วย IGNORE ไม่ได้ ต้องเช็คก่อน)
SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = 'fk_user_userrole1'
);
SET @sql := IF(@fk_exists=0,
  'ALTER TABLE `user` ADD CONSTRAINT `fk_user_userrole1` FOREIGN KEY (`userrole_id`) REFERENCES `userrole` (`userrole_id`);',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) userlog (อ้าง user)
CREATE TABLE IF NOT EXISTS `userlog` (
  `userlog_id` int(11) NOT NULL AUTO_INCREMENT,
  `ipaddress` varchar(45) DEFAULT NULL,
  `activity` text DEFAULT NULL,
  `date` datetime DEFAULT current_timestamp(),
  `user_id` int(11) NOT NULL,
  PRIMARY KEY (`userlog_id`,`user_id`),
  KEY `fk_userlog_user1_idx` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_uca1400_ai_ci;

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = 'fk_userlog_user1'
);
SET @sql := IF(@fk_exists=0,
  'ALTER TABLE `userlog` ADD CONSTRAINT `fk_userlog_user1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`);',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4) section_user (อ้าง user + section) -> สร้างแบบ "ยังไม่ใส่ FK" ก่อน
-- หมายเหตุ: ถ้าโปรเจคมีตาราง section แล้วค่อยไป add FK ได้ภายหลัง
CREATE TABLE IF NOT EXISTS `section_user` (
  `section_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  PRIMARY KEY (`section_id`,`user_id`),
  KEY `fk_section_user_user1_idx` (`user_id`),
  KEY `fk_section_user_section1_idx` (`section_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_uca1400_ai_ci;

-- FK: user
SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = 'fk_section_user_user1'
);
SET @sql := IF(@fk_exists=0,
  'ALTER TABLE `section_user` ADD CONSTRAINT `fk_section_user_user1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`);',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FK: section (ถ้ามี table `section` แล้ว)
SET @section_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'section'
);
SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = 'fk_section_user_section1'
);

SET @sql := IF(@section_exists>0 AND @fk_exists=0,
  'ALTER TABLE `section_user` ADD CONSTRAINT `fk_section_user_section1` FOREIGN KEY (`section_id`) REFERENCES `section` (`section_id`);',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
