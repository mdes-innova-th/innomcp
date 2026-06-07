# 📦 Dependencies Installation Guide

## ติดตั้ง Dependencies สำหรับ 5 Tools ใหม่

### 1. Currency Exchange Tool
```bash
cd innomcp-server-node
npm install axios
```
**API**: exchangerate-api.com (free tier)
**Use**: ดึงอัตราแลกเปลี่ยนเงิน realtime

---

### 2. QR Code Tool
```bash
npm install qrcode
npm install --save-dev @types/qrcode
```
**Library**: qrcode (npm)
**Use**: สร้าง QR code เป็น PNG base64

---

### 3. Translation Tool
```bash
npm install axios
# LibreTranslate API ใช้ axios ในการเรียก API
```
**API**: libretranslate.com (free)
**Use**: แปลภาษา (100+ languages)

---

### 4. RSS Feed Tool
```bash
npm install rss-parser
npm install --save-dev @types/rss-parser
```
**Library**: rss-parser
**Use**: อ่าน RSS/Atom feeds

---

### 5. Code Formatter Tool
```bash
npm install prettier
```
**Library**: prettier
**Use**: Format code (JS, TS, JSON, CSS, HTML, etc.)

---

## ติดตั้งทั้งหมดรวดเดียว

```bash
cd /mnt/c/Users/USER-NT/DEV/innomcp/innomcp-server-node

# Install production dependencies
npm install axios qrcode rss-parser prettier

# Install dev dependencies
npm install --save-dev @types/qrcode @types/rss-parser
```

---

## ตรวจสอบ package.json

หลังจากติดตั้งแล้ว ควรเห็น dependencies ใน `package.json`:

```json
{
  "dependencies": {
    "axios": "^1.6.x",
    "qrcode": "^1.5.x",
    "rss-parser": "^3.13.x",
    "prettier": "^3.1.x"
  },
  "devDependencies": {
    "@types/qrcode": "^1.5.x",
    "@types/rss-parser": "^3.13.x"
  }
}
```

---

## ตรวจสอบการติดตั้ง

```bash
# ตรวจสอบว่า packages ถูกติดตั้งแล้ว
ls node_modules | grep -E "axios|qrcode|rss-parser|prettier"

# ตรวจสอบ version
npm list axios qrcode rss-parser prettier
```

---

## หาก axios มีอยู่แล้ว

`axios` อาจมีอยู่แล้วใน project (ใช้ร่วมกับ tools อื่น) - ไม่ต้องติดตั้งใหม่

```bash
# ตรวจสอบ axios version
npm list axios
```

---

## เริ่มใช้งาน

หลังจากติดตั้ง dependencies แล้ว:

1. **Restart MCP Server:**
   ```bash
   cd innomcp-server-node
   npm run dev
   ```

2. **ตรวจสอบ tools ใหม่:**
   ```bash
   curl http://localhost:3012/health
   ```

3. **ทดสอบ tools:**
   ```bash
   # ดูใน tests/
   npm test currencyExchangeTool.test.ts
   npm test qrCodeTool.test.ts
   npm test translationTool.test.ts
   npm test rssFeedTool.test.ts
   npm test codeFormatterTool.test.ts
   ```

---

## Troubleshooting

### Error: Cannot find module 'qrcode'
```bash
npm install qrcode @types/qrcode
```

### Error: Cannot find module 'rss-parser'
```bash
npm install rss-parser @types/rss-parser
```

### Error: Cannot find module 'prettier'
```bash
npm install prettier
```

### TypeScript errors
```bash
# ติดตั้ง types ที่ขาดหาย
npm install --save-dev @types/qrcode @types/rss-parser
```

---

**พร้อมใช้งาน 5 Tools ใหม่! 🎉**
