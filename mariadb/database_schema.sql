/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.11.13-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: innomcp-db
-- ------------------------------------------------------
-- Server version	10.11.13-MariaDB-0ubuntu0.24.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `apikey`
--

DROP TABLE IF EXISTS `apikey`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `apikey`
--

LOCK TABLES `apikey` WRITE;
/*!40000 ALTER TABLE `apikey` DISABLE KEYS */;
INSERT INTO `apikey` VALUES
(2,'00b8518e7f2f18c7946797265ee15565:e69563760b201b9e4f6746787bdd82bc0afb92215ed39ffefb9d3771f25162a84ab46b0127091633efde575c8f2b3ccf1d16536ed349ee56a8bf12ab7b90b341','active','localhost','2025-06-22 12:11:05',NULL,'2025-08-09 07:22:12',10,NULL,NULL),
(3,'bbc9bd99fbb1998d6f94c065824d3e5e:a2a17f221a8ffff2980192eeec842f2e849eba3ef77a6ec0db06cc516edf82b36a41ce7b238d109e9fd8f2aac23eee80af895545aa2bd34811084c8efa1c3f24','active','localhost','2025-07-15 15:50:39',NULL,'2025-08-11 10:52:48',50,NULL,26),
(5,'46ede7369f45d2d233291644dd46d318:e71c0710b107300af79add646831b6055b6d33a7563cfc2e3896324ccf8a74c4e1b06b8fcdd958f179693709f19605828ffbb273273aac2a2f05b902bf136200','active','cct_c380b8611b44429889b975724172017e_key','2025-09-04 18:57:16',NULL,'2025-09-04 18:57:16',NULL,NULL,33),
(6,'73415a547318091eda20a02b6539c2e5:8d73a2676df1a793c3ded48887a3747a2a0bc0bd425e30835a0949f5176ef64deb226aa3e643aa6b745f231225b67e11392f99849eb6e805a93149f65036e7cc','active','innomcp base api key','2025-09-08 09:27:14',NULL,'2025-09-08 09:27:14',100,NULL,NULL);
/*!40000 ALTER TABLE `apikey` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `section`
--

DROP TABLE IF EXISTS `section`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `section` (
  `section_id` int(11) NOT NULL AUTO_INCREMENT,
  `section_name` varchar(100) NOT NULL,
  PRIMARY KEY (`section_id`),
  UNIQUE KEY `section_name_UNIQUE` (`section_name`),
  UNIQUE KEY `section_id_UNIQUE` (`section_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `section`
--

LOCK TABLES `section` WRITE;
/*!40000 ALTER TABLE `section` DISABLE KEYS */;
INSERT INTO `section` VALUES
(3,'กรมอุตุนิยมวิทยา'),
(4,'สำนักงานคณะกรรมการดิจิทัลเพื่อเศรษฐกิจและสังคมแห่งชาติ'),
(1,'สำนักงานปลัดกระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม'),
(2,'สำนักงานสถิติแห่งชาติ');
/*!40000 ALTER TABLE `section` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `section_user`
--

DROP TABLE IF EXISTS `section_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `section_user`
--

LOCK TABLES `section_user` WRITE;
/*!40000 ALTER TABLE `section_user` DISABLE KEYS */;
/*!40000 ALTER TABLE `section_user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user` (
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
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `user_id_UNIQUE` (`user_id`),
  UNIQUE KEY `username_UNIQUE` (`username`),
  UNIQUE KEY `user_email_UNIQUE` (`user_email`),
  KEY `fk_user_userrole1_idx` (`userrole_id`),
  CONSTRAINT `fk_user_userrole1` FOREIGN KEY (`userrole_id`) REFERENCES `userrole` (`userrole_id`)
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user`
--

LOCK TABLES `user` WRITE;
/*!40000 ALTER TABLE `user` DISABLE KEYS */;
INSERT INTO `user` VALUES
(26,'jlapps','$2b$10$LjoQz/d1dnZmK60AsJvDTO35ygxx2ORLBsF52Tjpm2vRF.FH4S9uO','lb2rock@gmail.com','Administrator',NULL,'1',NULL,NULL,0,NULL),
(28,'jaran.l','$2b$10$LjoQz/d1dnZmK60AsJvDTO35ygxx2ORLBsF52Tjpm2vRF.FH4S9uO','jaran.x@gmail.com','Jaran Laothong',NULL,'1',NULL,NULL,1,'0876636364'),
(29,'jaran.ltg','$2b$10$LjoQz/d1dnZmK60AsJvDTO35ygxx2ORLBsF52Tjpm2vRF.FH4S9uO','jaran.ltg@gmail.com','Lek',NULL,'1',NULL,NULL,1,'22222222'),
(30,'officer','$2b$10$LjoQz/d1dnZmK60AsJvDTO35ygxx2ORLBsF52Tjpm2vRF.FH4S9uO','officer@gmail.com','ผู้ตรวจสอบ',NULL,'1',NULL,NULL,2,NULL),
(31,'jaran.lao','$2b$10$LjoQz/d1dnZmK60AsJvDTO35ygxx2ORLBsF52Tjpm2vRF.FH4S9uO','jaran.lao@gmail.com','OXy',NULL,'1',NULL,NULL,1,''),
(32,'officer2','$2b$10$jpKpG2shw7cT4T8MXPAUFeciKPcD81lL5e4gWnzmannc.uA38FvEG','offiicer2@gmail.com','ผู้ตรวจสอบ2',NULL,'1',NULL,NULL,2,'0876636364'),
(33,'cct_c380b8611b44429889b975724172017e','$2b$10$FnWGDWQHp5MPj9gcL8roWuCd3reJ./s/BfyBpjhKuEwCL/iyh.NZS',NULL,'John Doe','1990-01-01','1',NULL,NULL,1,NULL);
/*!40000 ALTER TABLE `user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `userlog`
--

DROP TABLE IF EXISTS `userlog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `userlog` (
  `userlog_id` int(11) NOT NULL AUTO_INCREMENT,
  `ipaddress` varchar(45) DEFAULT NULL,
  `activity` text DEFAULT NULL,
  `date` datetime DEFAULT current_timestamp(),
  `user_id` int(11) NOT NULL,
  PRIMARY KEY (`userlog_id`,`user_id`),
  KEY `fk_userlog_user1_idx` (`user_id`),
  CONSTRAINT `fk_userlog_user1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=178 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `userlog`
--

LOCK TABLES `userlog` WRITE;
/*!40000 ALTER TABLE `userlog` DISABLE KEYS */;
INSERT INTO `userlog` VALUES
(1,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36]','2025-09-08 08:12:39',26),
(2,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36]','2025-09-08 08:15:57',26),
(3,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36]','2025-09-08 17:51:02',26),
(4,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36]','2025-09-08 17:51:38',26),
(5,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36]','2025-09-08 17:51:39',26),
(6,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36]','2025-09-08 20:39:09',26),
(7,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36]','2025-09-08 20:39:44',26),
(8,'::1','Logout/Cookie cleared [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36]','2025-09-08 20:39:58',26),
(9,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36]','2025-09-18 07:55:25',26),
(10,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36]','2025-09-18 07:59:46',26),
(11,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36]','2025-09-18 08:02:39',26),
(12,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-18 19:46:49',26),
(13,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-18 19:47:17',26),
(14,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-18 19:49:20',26),
(15,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 01:32:07',26),
(16,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 01:33:05',28),
(17,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 07:33:26',28),
(18,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 07:34:17',28),
(19,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 08:01:34',28),
(20,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 08:02:03',28),
(21,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 08:45:48',28),
(22,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 08:46:20',28),
(23,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 13:38:33',28),
(24,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 13:39:07',28),
(25,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 14:31:42',28),
(26,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 14:35:01',28),
(27,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 14:40:11',28),
(28,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 14:42:49',28),
(29,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 14:44:17',28),
(30,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 14:59:31',28),
(31,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 15:09:03',28),
(32,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 15:09:32',28),
(33,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 15:33:36',28),
(34,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 15:34:29',28),
(35,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 16:27:20',28),
(36,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 16:30:38',28),
(37,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 16:31:27',28),
(38,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-19 18:07:49',28),
(39,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-21 08:40:19',28),
(40,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-21 08:42:42',28),
(41,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-21 21:56:11',28),
(42,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-21 23:23:21',28),
(43,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-21 23:23:54',28),
(44,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-21 23:24:24',28),
(45,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-21 23:27:19',28),
(46,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-21 23:49:38',28),
(47,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-21 23:50:33',28),
(48,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-21 23:52:51',28),
(49,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-21 23:56:46',28),
(50,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-21 23:58:07',28),
(51,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 00:00:14',28),
(52,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 00:03:51',28),
(53,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 00:07:19',28),
(54,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 00:08:06',28),
(55,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 00:10:56',28),
(56,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 00:13:50',28),
(57,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 00:17:12',28),
(58,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 00:19:21',28),
(59,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 00:24:10',28),
(60,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 00:31:32',28),
(61,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 18:02:38',26),
(62,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 18:08:54',26),
(63,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 18:10:35',26),
(64,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 18:10:42',26),
(65,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 18:16:02',28),
(66,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 18:16:13',28),
(67,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 18:17:42',28),
(68,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 18:19:45',28),
(69,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 18:20:04',28),
(70,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 18:21:56',28),
(71,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 18:23:04',28),
(72,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 18:25:33',28),
(73,'::1','Logout/Cookie cleared [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 18:27:50',28),
(74,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 18:32:16',26),
(75,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 18:33:29',26),
(76,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 18:34:31',26),
(77,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 18:34:56',26),
(78,'::1','Logout/Cookie cleared [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-22 18:35:01',26),
(79,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 08:36:56',26),
(80,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 08:37:40',26),
(81,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 08:37:54',26),
(82,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 08:41:29',26),
(83,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 08:42:23',26),
(84,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 08:42:48',26),
(85,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 08:43:02',26),
(86,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 08:43:32',26),
(87,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 08:43:52',26),
(88,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 08:44:05',26),
(89,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 20:52:39',26),
(90,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 21:19:33',26),
(91,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 21:20:12',26),
(92,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 21:36:08',26),
(93,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 21:39:49',26),
(94,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 21:49:12',26),
(95,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 21:50:22',26),
(96,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 22:06:35',26),
(97,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 22:08:13',26),
(98,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 22:10:28',26),
(99,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 22:11:29',26),
(100,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 22:11:55',26),
(101,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 22:14:26',26),
(102,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 22:15:46',26),
(103,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 22:20:33',26),
(104,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 22:24:03',26),
(105,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 22:26:04',26),
(106,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 22:29:19',26),
(107,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 22:31:19',26),
(108,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 22:32:40',26),
(109,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 22:33:16',26),
(110,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 22:41:54',26),
(111,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 22:43:52',26),
(112,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 22:47:42',26),
(113,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 22:52:22',26),
(114,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 22:58:01',26),
(115,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 23:04:46',26),
(116,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 23:05:54',26),
(117,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-23 23:06:52',26),
(118,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-24 14:46:15',26),
(119,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-24 14:50:14',26),
(120,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-24 14:55:51',26),
(121,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-24 15:01:56',26),
(122,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-24 15:03:22',26),
(123,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-24 15:06:54',28),
(124,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-24 15:13:52',28),
(125,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-24 23:03:46',28),
(126,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-24 23:36:18',28),
(127,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-24 23:36:48',28),
(128,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-25 11:54:41',28),
(129,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-25 11:55:28',28),
(130,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-25 11:56:25',28),
(131,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-26 19:43:47',26),
(132,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-26 19:46:49',26),
(133,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-26 22:18:18',26),
(134,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-09-26 22:20:53',26),
(135,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-06 08:23:37',26),
(136,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-06 17:45:19',26),
(137,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-06 18:22:14',26),
(138,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-06 18:24:27',26),
(139,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-06 18:26:24',26),
(140,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-07 07:50:22',26),
(141,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-07 07:51:06',26),
(142,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-07 09:02:35',26),
(143,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-07 18:24:31',26),
(144,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-07 18:30:47',26),
(145,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-07 19:07:06',26),
(146,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-07 19:15:30',26),
(147,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-07 19:17:32',26),
(148,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-07 19:18:43',26),
(149,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-07 19:21:05',26),
(150,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-07 19:23:05',28),
(151,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-07 19:37:09',28),
(152,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-07 19:38:31',28),
(153,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-07 19:38:49',28),
(154,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-07 21:23:05',28),
(155,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-07 21:24:24',28),
(156,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-08 17:53:34',28),
(157,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-08 17:56:08',28),
(158,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-08 17:58:15',28),
(159,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36]','2025-10-11 08:36:56',26),
(160,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36]','2025-10-15 02:32:02',26),
(161,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36]','2025-10-15 02:54:02',26),
(162,'::1','Logout/Cookie cleared [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36]','2025-10-15 02:57:37',26),
(163,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36]','2025-10-15 02:58:23',28),
(164,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36]','2025-10-28 23:33:33',26),
(165,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36]','2025-10-28 23:38:41',26),
(166,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36]','2025-10-29 07:29:10',26),
(167,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36]','2025-10-29 07:29:24',26),
(168,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36]','2025-10-29 07:32:54',26),
(169,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36]','2025-10-29 07:44:51',26),
(170,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36]','2025-10-29 07:45:33',26),
(171,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36]','2025-10-29 07:49:48',26),
(172,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36]','2025-10-29 07:50:18',26),
(173,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36]','2025-10-29 07:59:58',26),
(174,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36]','2025-10-29 09:00:04',26),
(175,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36]','2025-10-29 17:51:57',26),
(176,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36]','2025-11-01 23:32:03',26),
(177,'::1','Login/Authenticated [UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36]','2025-11-03 02:06:30',26);
/*!40000 ALTER TABLE `userlog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `userrole`
--

DROP TABLE IF EXISTS `userrole`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `userrole` (
  `userrole_id` int(11) NOT NULL AUTO_INCREMENT,
  `userrole_name` varchar(20) NOT NULL,
  PRIMARY KEY (`userrole_id`),
  UNIQUE KEY `userrole_id_UNIQUE` (`userrole_id`),
  UNIQUE KEY `userrole_name_UNIQUE` (`userrole_name`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `userrole`
--

LOCK TABLES `userrole` WRITE;
/*!40000 ALTER TABLE `userrole` DISABLE KEYS */;
INSERT INTO `userrole` VALUES
(0,'administrator'),
(2,'เจ้าหน้าที่'),
(1,'ประชาชน'),
(3,'ผู้นำเข้าข้อมูล'),
(4,'ผู้บริหาร');
/*!40000 ALTER TABLE `userrole` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'innomcp-db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-03 21:36:05
