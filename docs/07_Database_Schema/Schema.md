# โครงสร้างฐานข้อมูล (Database Schema)

เราใช้ **MariaDB** เป็นฐานข้อมูลหลัก เก็บข้อมูลแบบ Relational Database

## แผนภาพความสัมพันธ์ (ER Diagram)

- **Users** 1 : N **Sessions**
- **Sessions** 1 : N **Chats**

## รายละเอียดตาราง (Tables)

### 1. `users`
เก็บข้อมูลผู้ใช้งานระบบ
*   `id` (INT, PK): รหัสผู้ใช้
*   `username` (VARCHAR): ชื่อผู้ใช้
*   `password_hash` (VARCHAR): รหัสผ่านที่เข้ารหัสแล้ว (Bcrypt)
*   `created_at`: วันที่สมัคร

### 2. `sessions`
เก็บข้อมูลห้องแชท (Chat Room)
*   `id` (UUID, PK): รหัส Session
*   `user_id` (INT, FK): เจ้าของห้อง
*   `title` (VARCHAR): ชื่อหัวข้อ (AI ตั้งให้อัตโนมัติ หรือ User ตั้งเอง)
*   `created_at`: วันที่สร้าง

### 3. `chats`
เก็บข้อความในแต่ละห้องแชท
*   `id` (INT, PK): รหัสข้อความ
*   `session_id` (UUID, FK): อยู่ในห้องไหน
*   `role` (ENUM): ผู้ส่ง (`user`, `assistant`, `system`)
*   `content` (TEXT): เนื้อหาข้อความ
*   `created_at`: เวลาที่ส่ง

---
*ฐานข้อมูลถูกออกแบบให้รองรับการเก็บ Chat History พร้อม Indexing เพื่อให้ค้นหาข้อความเก่าๆ ได้รวดเร็ว*
