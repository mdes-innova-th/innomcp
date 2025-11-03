-- ===================================================================
-- สร้างฐานข้อมูลสำหรับระบบ Report Site
-- ===================================================================

USE `webd-db`;


-- ===================================================================
-- ตาราง userrole: เก็บข้อมูลบทบาทของผู้ใช้
-- ===================================================================

CREATE TABLE IF NOT EXISTS `userrole`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `userrole` (
  `userrole_id` int(11) NOT NULL AUTO_INCREMENT,
  `userrole_name` varchar(20) NOT NULL,
  PRIMARY KEY (`userrole_id`),
  UNIQUE KEY `userrole_id_UNIQUE` (`userrole_id`),
  UNIQUE KEY `userrole_name_UNIQUE` (`userrole_name`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_uca1400_ai_ci;

-- แทรกข้อมูลบทบาทผู้ใช้

INSERT INTO `userrole` VALUES
(0,'administrator'),
(2,'เจ้าหน้าที่'),
(1,'ประชาชน'),
(3,'ผู้นำเข้าข้อมูล'),
(4,'ผู้บริหาร');

-- ===================================================================
-- ตาราง user: เก็บข้อมูลผู้ใช้
-- ===================================================================

CREATE TABLE IF NOT EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user` (
  `user_id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(45) NOT NULL,
  `password` text DEFAULT NULL,
  `user_email` varchar(200) DEFAULT NULL,
  `user_dispname` varchar(100) NOT NULL,
  `user_birthdate` date DEFAULT NULL,
  `user_active` char(1) NOT NULL,
  `reset_token` varchar(255) DEFAULT NULL,
  `reset_token_expire` datetime DEFAULT NULL,
  `userrole_id` int(11) NOT NULL,
  `user_phone` varchar(30) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `user_id_UNIQUE` (`user_id`),
  UNIQUE KEY `user_email_UNIQUE` (`user_email`),
  UNIQUE KEY `username_UNIQUE` (`username`),
  KEY `fk_user_userrole1_idx` (`userrole_id`),
  CONSTRAINT `fk_user_userrole1` FOREIGN KEY (`userrole_id`) REFERENCES `userrole` (`userrole_id`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_uca1400_ai_ci;

-- แทรกข้อมูลผู้ใช้

INSERT INTO `user` VALUES
(26,'jlapps','$2b$10$LjoQz/d1dnZmK60AsJvDTO35ygxx2ORLBsF52Tjpm2vRF.FH4S9uO','lb2rock@gmail.com','Administrator','1',NULL,NULL,0,NULL),
(28,'jaran.l','$2b$10$YE9mbqgJlb/wOn/hr0c.0.qO3vuYUBF00kDJ3zTIsMx3toA70521O','jaran.l@mdes.go.th','Jaran Laothong','1',NULL,NULL,1,'0876636364');

-- ===================================================================
-- ตาราง section: เก็บข้อมูลหน่วยงาน
-- ===================================================================

CREATE TABLE `section` (
  `section_id` int(11) NOT NULL AUTO_INCREMENT,
  `section_name` varchar(100) NOT NULL,
  PRIMARY KEY (`section_id`),
  UNIQUE KEY `section_name_UNIQUE` (`section_name`),
  UNIQUE KEY `section_id_UNIQUE` (`section_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- แทรกข้อมูลหน่วยงาน

INSERT INTO `section` (section_id, section_name) VALUES(3, 'กรมอุตุนิยมวิทยา');
INSERT INTO `section` (section_id, section_name) VALUES(4, 'สำนักงานคณะกรรมการดิจิทัลเพื่อเศรษฐกิจและสังคมแห่งชาติ');
INSERT INTO `section` (section_id, section_name) VALUES(5, 'สำนักงานรัฐมนตรี');
INSERT INTO `section` (section_id, section_name) VALUES(1, 'สำนักงานปลัดกระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม');
INSERT INTO `section` (section_id, section_name) VALUES(2, 'สำนักงานสถิติแห่งชาติ');
INSERT INTO `section` (section_id, section_name) VALUES(6, 'สำนักงานส่งเสริมเศรษฐกิจดิจิทัล');
INSERT INTO `section` (section_id, section_name) VALUES(7, 'สำนักงานพัฒนาธุรกรรมทางอิเล็กทรอนิกส์');
INSERT INTO `section` (section_id, section_name) VALUES(8, 'สำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล');
INSERT INTO `section` (section_id, section_name) VALUES(9, 'สถาบันข้อมูลขนาดใหญ่ (องค์การมหาชน)');
INSERT INTO `section` (section_id, section_name) VALUES(10, 'บริษัท ไปรษณีย์ไทย จำกัด');
INSERT INTO `section` (section_id, section_name) VALUES(11, 'บริษัท โทรคมนาคมแห่งชาติ จำกัด (มหาชน)');

-- ====================================================================
-- ตารางเชื่อมโยงผู้ใช้กับหน่วยงาน
-- ====================================================================

CREATE TABLE `section_user` (
  `section_user_id` int(11) NOT NULL AUTO_INCREMENT,
  `section_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `section_user_date` date NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`section_user_id`,`section_id`,`user_id`),
  KEY `fk_user_section_section1_idx` (`section_id`),
  KEY `fk_user_section_user1_idx` (`user_id`),
  CONSTRAINT `fk_user_section_section1` FOREIGN KEY (`section_id`) REFERENCES `section` (`section_id`),
  CONSTRAINT `fk_user_section_user1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_uca1400_ai_ci;

-- ====================================================================
-- ตารางเก็บ API Key
-- ====================================================================

CREATE TABLE `apikey` (
  `apikey_id` int(11) NOT NULL AUTO_INCREMENT,
  `apikey` varchar(255) NOT NULL,
  `status` enum('active','inactive','revoke') NOT NULL DEFAULT 'active',
  `apikey_name` varchar(45) DEFAULT NULL,
  `create` timestamp NULL DEFAULT current_timestamp(),
  `expire` timestamp NULL DEFAULT NULL,
  `update` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `rate_limit` int(11) DEFAULT NULL,
  `allowed_origins` varchar(100) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`apikey_id`),
  UNIQUE KEY `idapikey_id_UNIQUE` (`apikey_id`),
  UNIQUE KEY `apikey_UNIQUE` (`apikey`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_uca1400_ai_ci;

INSERT INTO apikey (apikey, status, apikey_name, `create`, expire, `update`, rate_limit, allowed_origins, user_id) VALUES('c7eb3a7e25941618eb807967934218ee:749d3410881c888b314652bc9745869470aed0257862133ce448a4952edcebe578545603754620fa8264141081f57976f607f94171c994c9a66dd912141e87e9', 'active', 'asdapp', '2025-08-25 00:52:45.000', NULL, '2025-08-25 00:52:45.000', NULL, NULL, NULL);
INSERT INTO apikey
(apikey, status, apikey_name, `create`, expire, `update`, rate_limit, allowed_origins, user_id)
VALUES('73415a547318091eda20a02b6539c2e5:8d73a2676df1a793c3ded48887a3747a2a0bc0bd425e30835a0949f5176ef64deb226aa3e643aa6b745f231225b67e11392f99849eb6e805a93149f65036e7cc', 'active', 'webddsb base api key', '2025-09-08 16:27:14.000', NULL, '2025-09-08 16:27:14.000', 100, NULL, NULL);

-- ===================================================================
-- ตาราง userlog: เก็บบันทึกกิจกรรมของผู้ใช้
-- ===================================================================

CREATE TABLE `userlog` (
  `userlog_id` int(11) NOT NULL AUTO_INCREMENT,
  `ipaddress` varchar(45) DEFAULT NULL,
  `activity` text DEFAULT NULL,
  `date` datetime DEFAULT current_timestamp(),
  `user_id` int(11) NOT NULL,
  PRIMARY KEY (`userlog_id`,`user_id`),
  KEY `fk_userlog_user1_idx` (`user_id`),
  CONSTRAINT `fk_userlog_user1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ===================================================================
-- สร้าง Index เพื่อเพิ่มประสิทธิภาพการ Query ข้อมูล
-- ===================================================================

-- Index สำหรับตารางที่เกี่ยวข้องกับ API urlstats
CREATE INDEX idx_case_group_name ON case_group (group_name);
CREATE INDEX idx_case_listdata_date ON case_listdata (creatdate);
CREATE INDEX idx_case_category_group ON case_category (group_id);
CREATE INDEX idx_petition_data_id ON petition_data (petition_id);
CREATE INDEX idx_case_order_id ON case_order (order_id);
CREATE INDEX idx_case_category_id ON case_category (category_id);
CREATE INDEX idx_case_group_id ON case_group (group_id);
CREATE INDEX idx_petition_id ON case_listdata (petition_id);
CREATE INDEX idx_order_date ON case_order (orderred_date);
CREATE INDEX idx_case_listdata_order_id ON case_listdata (order_id);
CREATE INDEX idx_case_listdata_category_id ON case_listdata (category_id);
-- composite index
CREATE INDEX idx_case_list_petition_id ON case_listdata (petition_id, case_id);
CREATE INDEX idx_case_list_order_id ON case_listdata (order_id, case_id);
CREATE INDEX idx_case_order_date_id ON case_order (orderred_date, order_id);
CREATE INDEX idx_case_listdata_order_category ON case_listdata (order_id, category_id);
CREATE INDEX idx_case_listdata_category ON case_listdata (case_id, category_id);
CREATE INDEX idx_category_case_listdata ON case_listdata (category_id, case_id);
CREATE INDEX idx_case_listdata_category_case ON case_listdata(category_id, case_id);
-- cover index
CREATE INDEX idx_case_listdata_cover ON case_listdata (order_id, category_id, case_id);

-- เพิ่ม Index ใหม่สำหรับเพิ่มประสิทธิภาพการค้นหาข้อมูลตามที่ API ต่างๆ ต้องการ
-- Index for fetchGroupsNames
CREATE INDEX idx_case_group_group_id_name ON case_group (group_id, group_name);

-- Index for fetchUrlsByViolationGroup
CREATE INDEX idx_case_listdata_creatdate ON case_listdata (creatdate);
CREATE INDEX idx_case_listdata_case_id ON case_listdata (case_id);
CREATE INDEX idx_case_category_group_id ON case_category (group_id, category_id);
CREATE INDEX idx_case_listdata_group_date ON case_listdata (category_id, creatdate);

-- Index for fetchUrlsByDateAndGroup
CREATE INDEX idx_case_listdata_date_group ON case_listdata (creatdate, category_id);
CREATE INDEX idx_case_listdata_date_case ON case_listdata (creatdate, case_id);

-- Index for fetchTotalUrlCount
CREATE INDEX idx_case_listdata_caselist_id ON case_listdata (caselist_id);

-- Index for fetchAIUrlCount
CREATE INDEX idx_case_listdata_ai ON case_listdata (case_id, category_id, creatdate);

-- Index for fetchUrlsByDateAI
CREATE INDEX idx_case_listdata_ai_date ON case_listdata (creatdate, case_id, category_id);

-- Index for fetchUrlsByMonthAndGroup
CREATE INDEX idx_case_listdata_month_group ON case_listdata (creatdate, category_id);

-- Index for fetchUrlsByMonthAI
CREATE INDEX idx_case_listdata_month_ai ON case_listdata (creatdate, case_id, category_id);

-- Index for fetchTopOffice
CREATE INDEX idx_admin_main_superadmin ON admin_main (id_member, superadmin);
CREATE INDEX idx_tb_userdepartment_type ON tb_userdepartment (department_id, department_type);

-- Index for fetchTopCategory
CREATE INDEX idx_case_group_contract_count ON case_group (group_id, group_name);

-- Index for fetchTopCourt
CREATE INDEX idx_case_order_court ON case_order (order_id, orderred_date);

-- Index for fetchYearlyTrends
CREATE INDEX idx_case_order_year ON case_order (orderred_date, order_id);

-- Index for fetchMonthlyTrends
CREATE INDEX idx_case_order_month ON case_order (orderred_date, order_id);

-- Index for fetchProcessTimes
CREATE INDEX idx_case_listdata_process ON case_listdata (creatdate, round_date, approve_date, petition_date, order_id);
CREATE INDEX idx_case_order_process ON case_order (orderred_date, order_id);


-- ลบ Index ที่สร้างทั้งหมด -- สำหรับทดสอบ
-- DROP INDEX idx_case_group_name ON case_group;
-- DROP INDEX idx_case_listdata_date ON case_listdata;
-- DROP INDEX idx_case_listdata_category ON case_listdata;
-- DROP INDEX idx_case_listdata_category_case ON case_listdata;
-- DROP INDEX idx_case_listdata_order_category ON case_listdata;
-- DROP INDEX idx_case_listdata_order_id ON case_listdata;
-- DROP INDEX idx_case_listdata_petition_id ON case_listdata;
-- DROP INDEX idx_case_listdata_case_id ON case_listdata;
-- DROP INDEX idx_case_category_group ON case_category;
-- DROP INDEX idx_case_order_id ON case_order;
-- DROP INDEX idx_case_group_id ON case_group;
-- DROP INDEX idx_petition_id ON petition_data;
-- DROP INDEX idx_order_date ON case_order;
-- DROP INDEX idx_case_list_petition_id ON case_listdata;
-- DROP INDEX idx_case_list_order_id ON case_listdata;
-- DROP INDEX idx_case_order_date_id ON case_order;
-- DROP INDEX idx_category_case_listdata ON case_listdata;
-- DROP INDEX idx_case_listdata_cover ON case_listdata;
-- DROP INDEX idx_case_listdata_ai ON case_listdata;
-- DROP INDEX idx_case_listdata_ai_date ON case_listdata;
-- DROP INDEX idx_case_listdata_month_group ON case_listdata;
-- DROP INDEX idx_case_listdata_month_ai ON case_listdata;
-- DROP INDEX idx_case_listdata_month_ai ON case_listdata;
-- DROP INDEX idx_admin_main_superadmin ON admin_main;
-- DROP INDEX idx_tb_userdepartment_type ON tb_userdepartment;
-- DROP INDEX idx_case_group_contract_count ON case_group;
-- DROP INDEX idx_case_order_court ON case_order;
-- DROP INDEX idx_case_order_year ON case_order;
-- DROP INDEX idx_case_order_month ON case_order;
-- DROP INDEX idx_case_listdata_process ON case_listdata;
-- DROP INDEX idx_case_order_process ON case_order;
-- DROP INDEX idx_case_listdata_caselist_id ON case_listdata;
-- DROP INDEX idx_case_listdata_group_date ON case_listdata;




-- ======================================================
-- เปลี่ยนแปลงโครงสร้างตาราง ระหว่างพัฒนา
-- ======================================================

-- ALTER TABLE `apikey`
-- ADD COLUMN `user_id` int(11) DEFAULT NULL COMMENT 'รหัสผู้ใช้ที่เป็นเจ้าของ API Key (FK จากตาราง user)' AFTER `allowed_origins`,
-- ADD CONSTRAINT `fk_apikey_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- GRANT REPLICATION SLAVE ON *.* TO 'jlapps'@'localhost';
-- GRANT BINLOG MONITOR ON *.* TO 'jlapps'@'localhost';
-- FLUSH PRIVILEGES;


-- ======================================================
-- ข้อมูลทดสอบ websocket
-- ======================================================
-- INSERT INTO case_listdata (case_id, category_id, meeting_id, meeting_adddate, petition_id, petition_date, order_id, caselist_no, caselist_round, caselist_url, hash, api_id, register_ip, register_country, url_source, publisher, publisher_info, evd_date, evd_code, evd_collect, evd_video, evd_picture, picture, description, creatdate, confirm, confirm_date, confirm_admin, approve, approve_date, approve_admin, approve_info, complete, complete_admin, roundcomplete, roundcomplete_admin, round, round_date, round_admin, round_info, delete_info, screenshot, heighlight_text, accuracy, randomcheck, publice, admin_id, list) VALUES(237, 17, 403, '2024-05-30 10:34:01', 0, '', 471, '202312070086', 2, 'gogoxo11.com', '', '0', '128.199.193.240', 'Singapore (SG)', '', '', '', '', '', '', '', '', 'B0220231203026.png', '', '2023-12-07 11:38', 1, '', 0, 1, '2023-12-08 11:06:12', 41, '', 0, 0, 0, 0, 1, '2023-12-07 12:19:59', 36, '', '', 0, '', 0, 0, 1, 36, 86);
-- DELETE FROM case_listdata WHERE `caselist_url`='gogoxo11.com';
