# แผนรับมือเหตุการณ์รั่วไหลของ Secret (Incident Response Playbook)

## 1. การคัดแยกเบื้องต้น (60-Second Triage)

1. **ยืนยันการรั่วไหล** – ตรวจสอบว่า token ปรากฏในสาธารณะหรือไม่ (GitHub, logs, Discord)
2. **ประเมินขอบเขต** – token ใดถูกเปิดเผย? ระบบใดที่เข้าถึงได้? (ใช้ `grep -r "TOKEN" .` เฉพาะใน repo ที่สงสัย)
3. **เพิกถอนทันที** – ไปที่ Revoke/Rotate Table ด้านล่าง ดำเนินการเพิกถอน token ที่รั่ว
4. **บันทึกเวลา** – จด timestamp และ token ที่รั่วไหลลงใน Incident Log
5. **แจ้งทีม** – ส่งข้อความไปยัง Discord #security-alert หรือ LINE group พร้อมรายละเอียด

**คำสั่งด่วน**: `git log --all -S "TOKEN"` เพื่อค้นหาประวัติ commit ที่มี token

---

## 2. ตารางเพิกถอนและหมุนเวียน Token (Revoke/Rotate Table)

| Provider | How to Revoke Old | How to Issue New | Where to Set New Value (.env or Doppler) | Dashboard Link |
|----------|-------------------|------------------|------------------------------------------|----------------|
| OLLAMA_TOKEN (MDES Ollama) | ไปที่ admin panel ของ MDES Ollama ลบ token เก่า | สร้าง token ใหม่จาก dashboard | `.env` / Doppler: `OLLAMA_TOKEN=...` | https://ollama.mdes-innova.online/admin |
| COMMANDCODE_API_KEY | commandcode.ai → Settings → Revoke key | Generate new key | `COMMANDCODE_API_KEY=...` | https://commandcode.ai/account |
| THAILLM_TOKEN | ติดต่อผู้ดูแลระบบหรือลบผ่าน API management | รับ token ใหม่จากผู้ให้บริการ | `THAILLM_TOKEN=...` | (ติดต่อผู้ดูแล) |
| DISCORD_TOKEN | Discord Developer Portal → Bot → Reset Token | คัดลอก token ใหม่ | `DISCORD_TOKEN=...` | https://discord.com/developers/applications |
| CODEX_API_KEY (OpenClaude JWT) | OpenClaude → API Keys → Revoke | สร้าง JWT ใหม่ | `CODEX_API_KEY=...` | (OpenClaude admin) |
| OPENAI_API_KEY | platform.openai.com → API keys → Revoke | Create new key | `OPENAI_API_KEY=...` | https://platform.openai.com/api-keys |
| GitHub PAT | github.com/settings/tokens → Delete old | Generate new classic/fine-grained PAT | `GITHUB_TOKEN=...` | https://github.com/settings/tokens |

---

## 3. หลังการหมุนเวียน (Post-Rotate)

### 3.1 ล้างประวัติ Git (ถ้า token ถูก commit)

```bash
git filter-repo --force --invert-paths --path-match "TOKEN"  # หรือใช้ --path-match เฉพาะไฟล์
git remote add origin <repo-url>
git push origin --force --all
```

> **สำคัญ**: แจ้งให้ทุกคน rebase งานของตนหลัง force push

### 3.2 ล้าง Cache

- **CDN / Proxy**: ล้าง cache ของ Vercel, Cloudflare, หรือ Nginx
- **CI/CD**: รีสตาร์ท pipeline ที่อาจมี token เก่าค้าง
- **Environment Variable**: รีโหลด .env หรือ Doppler ด้วยคำสั่ง `doppler secrets download --no-file`

### 3.3 แจ้งทีม

- **Discord**: ส่งข้อความไปยัง `#security` พร้อม incident ID และ action ที่ดำเนินการ
- **LINE**: ใช้ Notify API หรือแอดมินแจ้งในกลุ่ม

### 3.4 หลักการ “Nothing-is-Deleted”

**ทุกรายการ rotation ต้องถูกบันทึกไว้ในไฟล์ `rotations.log`** (หรือ Incident Log) เพื่อการตรวจสอบภายหลัง

---

## 4. แบบฝึกซ้อมบนโต๊ะ (Tabletop Drill)

### Scenario 1: นักพัฒนาทำ commit token ขึ้��� GitHub Public
- **Action**: Revoke token → `git filter-repo` → แจ้งทีม → สร้าง incident log

### Scenario 2: Token รั่วใน logs ของแอปพลิเคชัน (เช่น CloudWatch, Papertrail)
- **Action**: ระบุ source → Revoke token → ลบ log entries (ถ้าทำได้) → แจ้งทีม

### Scenario 3: พบ API Key ในข้อความ Discord สาธารณะ
- **Action**: ลบข้อความ → Revoke token → อัปเดต bot token (ถ้าเป็น Discord token) → แจ้งผู้เกี่ยวข้อง

### Checklist สำหรับ Drill
- [ ] มีการเพิกถอน token ภายใน 60 วินาที
- [ ] มีการบันทึก incident log
- [ ] มีการล้าง git history
- [ ] มีการแจ้งทีมผ่าน Discord/LINE
- [ ] มีการตรวจสอบว่าไม่มี token เก่าเหลือใน environment

---

## 5. แบบฟอร์มบันทึกเหตุการณ์ (Incident Log Template)

```
Incident ID: <SEC-YYYYMMDD-NNN>
Date/Time (UTC): 
Detected by: 
Token(s) affected: 
Source of leak: 
Actions taken:
  - Revoked: [Yes/No] เวลา:
  - Rotated: [Yes/No] เวลา:
  - Git purge: [Yes/No]
  - Cache invalidated: [Yes/No]
  - Team notified: [Discord/LINE] เวลา:
Notes:
Post-mortem link: (ถ้ามี)
```
