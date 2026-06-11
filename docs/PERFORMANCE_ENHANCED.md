# INNOMCP Performance Optimization Guide
# คู่มือเพิ่มประสิทธิภาพ INNOMCP

INNOMCP (MDES AI platform) leverages Next.js 14, Node.js/Express, and MDES Ollama for high‑throughput government AI services. This guide outlines both frontend and backend strategies to maintain sub‑second response times and stable operation under load.  
*INNOMCP (แพลตฟอร์ม AI ของ MDES) ใช้ Next.js 14, Node.js/Express และ MDES Ollama เพื่อรองรับบริการ AI ภาครัฐที่มีปริมาณสูง คู่มือนี้สรุปกลยุทธ์ทั้งฝั่ง client และ server เพื่อให้ตอบสนองในระดับต่ำกว่า 1 วินาทีและทำงานได้อย่างเสถียรภายใต้โหลด*

---

## Frontend Performance / ประสิทธิภาพส่วนหน้า

### Lazy‑loaded panels / โหลดพาเนลเมื่อจำเป็น
`LazyPanels.tsx` uses `next/dynamic` to split heavy agent panels, reducing initial bundle size.