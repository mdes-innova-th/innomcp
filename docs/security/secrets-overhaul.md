# คู่มือ Secrets Management สำหรับ Monorepo

## 1. สถานะปัจจุบัน (Current Status)
| # | Task | Status | Note |
|---|---|---|---|
| 1 | Repos git-clean | done | ลบ history ที่มี secrets ออกหมดแล้ว |
| 2 | .env gitignored | done | .gitignore ครอบคลุมทุก .env* อย่างถ��กต้อง |
| 3 | Gitleaks config | not-done | รอเพิ่ม .gitleaks.toml |
| 4 | Pre-commit hook | not-done | ยังไม่ได้ตั้ง secrets-guard.sh |
| 5 | CI secret-scan | not-done | ยังไม่มี workflow scan |
| 6 | Vault integration | not-done | ยังใช้ .env แบบ manual |
| 7 | Secret rotation | not-done | ยังไม่มีรอบการ rotate |
| 8 | OIDC setup | not-done | Actions ยังใช้ long-lived tokens |
| 9 | Log sanitization | not-done | ยังไม่ได้ใช้ sanitize-log.js |
| 10 | RBAC mapping | not-done | ยังไม่ได้จำกัดสิทธิ์ตาม role |
| 11 | Local env encryption | not-done | dev เก็บ .env แบบ plaintext |
| 12 | Leak alerting | not-done | ยังไม่มี webhook แจ้งเตือน |
| 13 | Dependency audit | not-done | ยังไม่ได้ scan package |
| 14 | Onboarding guide | not-done | ยังไม่มี doc สอน dev ใหม่ |

## 2. เครื่องมือที่ติดตั้งรอบนี้ (Tools Setup)
ไฟล์ที่เพิ่ม: `.gitleaks.toml`, `scripts/secrets-guard.sh`, `.github/workflows/secret-scan.yml`, `scripts/sanitize-log.js`

**การติดตั้ง:**
```bash
# ตั้งค่า pre-commit hooks
git config core.hooksPath .githooks

# ติดตั้ง Gitleaks บน Windows
scoop install gitleaks
# หรือใช้ Chocolatey
choco install gitleaks
```

## 3. นโยบาย (Policy)
* **Least-Privilege:** แต่ละ token ต้องมีสิทธิ์เท่าที่จำเป็นต่อการทำงานเท่านั้น
* **Short-TTL Rotation:** กำหนดอายุ token สั้นๆ และ rotate อย่างสม่ำเสมอ
* **Never Track .env:** ห้ามแก้ไข `.gitignore` เพื่อ track ไฟล์ `.env` เด็ดขาด

## 4. OIDC สำหรับ GitHub Actions
หยุดเก็บ long-lived tokens ใน Actions secrets ให้ใช้ OIDC เพื่อขอ ephemeral tokens จาก cloud provider แทน
```yaml
permissions:
  id-token: write
  contents: read
```

## 5. RBAC (Role-Based Access Control)
| Role | Token / Secret | Access Level |
|---|---|---|
| Developer | Local DB, Test API | Read/Write (Sandbox) |
| CI/CD Pipeline | OIDC Provider, Deploy Keys | Ephemeral (Prod/Stage) |
| Admin | Vault Master, Root Cloud | Full (Audit logged) |

## 6. ข้อแนะนำเรื่อง Vault
แนะนำ **Doppler** เน��่องจากเหมาะสมกับ scale ของ monorepo นี้:
* จัดการ env vars แบบรวมศูนย์ (Centralized)
* รองรับ multiple environments ในที่เดียว
* มี CLI และ SDK ที่ integrate กับ CI/CD และ local dev ได้ง่าย
