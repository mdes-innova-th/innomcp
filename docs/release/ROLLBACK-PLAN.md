# แผนการ Rollback สำหรับ innomcp

## เมื่อต้อง Rollback
- การ deploy ล้มเหลวหรือเกิดข้อผิดพลาดรุนแรง
- Service ไม่สามารถทำงานได้ปกติหลัง deployment
- พบ regression หรือ bug ที่ส่งผลต่อผู้ใช้
- Database migration ทำให้ข้อมูลเสียหาย

## ขั้นตอน Rollback
1. **หยุดบริการปัจจุบัน**
   ```bash
   docker compose down
   ```

2. **เช็คเอาท์ tag ก่อนหน้า**
   ```bash
   git checkout <previous-tag>
   ```
   *(หมายเหตุ: ห้ามลบ tag ใด ๆ ตามนโยบาย Nothing-is-Deleted)*

3. **Rebuild และเริ่มบริการ**
   ```bash
   docker compose build
   docker compose up -d
   ```

## ข้อควรระวังในการ Rollback Database Migration
- หาก migration ก่อนหน้ามีการเปลี่ยนแปลง schema แบบ backward-incompatible จำเป็นต้องใช้ migration rollback script
- **อย่า rollback โดยไม่ตรวจสอบ**ว่าฐานข้อมูลสามารถ revert ได้อย่างปลอดภัย
- ควรมี `down.sql` สำหรับ migration แต่ละครั้งเสมอ
- หลัง rollback ให้ตรวจสอบข้อมูลในตารางสำคัญว่าถูกต้อง

## การรักษาข้อมูลผู้ใช้
- Docker volume สำหรับข้อมูล (เช่น database, uploads) จะถูกเก็บไว้เสมอ
- **ไม่ต้องลบ volume** ระหว่าง rollback
- หากต้องการ restore ข้อมูล ให้ใช้ backup ก่อน deployment ล่าสุด

## การตรวจสอบความสำเร็จของ Rollback
- ตรวจสอบว่า container ทุกตัวทำงาน (docker compose ps)
- ทดสอบ endpoint หลัก (health check, API)
- ตรวจสอบ log ไม่มี error ร้ายแรง
- ตรวจสอบ database consistency (เช่น ผ่าน query ตัวอย่าง)

## การสื่อสาร
- แจ้งทีมผ่านช่องทางที่กำหนด (Slack, Teams, email)
- ระบุสาเหตุ เวลา rollback และสถานะปัจจุบัน
- อัปเดต ticket หรือ incident report
- หลัง rollback สำเร็จ ให้แจ้งผู้เกี่ยวข้องทันที
