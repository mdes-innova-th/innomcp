# INNOMCP Manus-Style UI Components

คู่มือการใช้งานคอมโพเนนต์สไตล์ Manus สำหรับแพลตฟอร์ม INNOMCP (MDES)  
*การผสมภาษาไทย-อังกฤษตลอดเอกสาร | Thai‑English mixed content*

---

## 1. MDESBrandHeader

**Purpose**  
แสดงแถบส่วนหัวมาตรฐานของแพลตฟอร์ม MDES INNOMCP พร้อมโลโก้กระทรวงและชื่อระบบ

**When to use**  
- ทุกหน้าที่ต้องการส่วนหัวกลางของระบบ (Admin, User Dashboard, Chat Interface)
- หน้าจอของบุคลากรภาครัฐที่ต้องแสดงตัวตนของแพลตฟอร์ม
- ส่วนติดต่อที่ต้องมีโลโก้ MDES และชื่อ INNOMCP อย่างเป็นทางการ

**Props**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `"INNOMCP"` | ชื่อแอปพลิเคชัน (ภาษาไทย/อังกฤษ) |
| `subtitle?` | `string` | — | คำบรรยายใต้ชื่อ (เช่น “แพลตฟอร์ม AI ภาครัฐ”) |
| `showUserMenu?` | `boolean` | `true` | แสดงเมนูผู้ใช้ (ชื่อ + avatar) |
| `userName?` | `string` | — | ชื่อผู้ใช้ที่ล็อกอิน |
| `userAvatar?` | `string` | — | URL รูป avatar |
| `onLogin?` | `() => void` | — | callback เมื่อคลิกปุ่มล็อกอิน (ถ้าไม่มี session) |
| `onLogout?` | `() => void` | — | callback ออกจากระบบ |
| `className?` | `string` | — | คลาส Tailwind เพิ่มเติม |

**Example**