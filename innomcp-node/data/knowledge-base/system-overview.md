# ระบบ Inno MCP — คู่มือสำหรับเจ้าหน้าที่

## ภาพรวมระบบ

Inno MCP (Innovation Model Context Protocol) เป็นระบบ AI Chat ที่ให้บริการข้อมูล:
- **สภาพอากาศ** — ดึงข้อมูลจาก TMD/NWP แสดงพยากรณ์ล่วงหน้า 7 วัน
- **หลักฐานดิจิทัล** — ข้อมูล URL ผิดกฎหมายและ NIP จากฐานข้อมูล Evidence
- **ข้อมูลภูมิศาสตร์** — ข้อมูลจังหวัด อำเภอ ตำบล ภาค
- **ความรู้ไทย** — กฎหมาย ประวัติศาสตร์ ชื่อราชวงศ์
- **เครื่องคิดเลข** — คำนวณสูตรทางคณิตศาสตร์
- **วันที่/เวลา** — แสดงวันที่และเวลาปัจจุบัน

## โหมดการทำงาน

| โหมด | คำอธิบาย |
|------|----------|
| Local GPU | ใช้ Ollama บนเครื่อง local (qwen2.5-coder:7b) |
| Remote AI | ใช้ Ollama บนเซิร์ฟเวอร์ remote (gemma3:12b) |
| Hybrid | ลอง remote ก่อน ถ้าไม่ได้ fallback เป็น local |

## การเชื่อมต่อ MCP Server

MCP Server (`innomcp-server-node`) ให้บริการ tools:
- `weatherPipeline` — ดึงข้อมูลอากาศจาก TMD
- `evidenceTool` — query ฐานข้อมูล evidence
- `thaiGeoTool` — lookup ข้อมูลจังหวัด/อำเภอ
- `thaiKnowledgeTool` — ค้นหาความรู้ไทย
- `calculatorTool` — คำนวณ
- `dateTimeTool` — วันที่/เวลา

## Budget และ Timeout

- General LLM budget: 60 วินาที
- Weather pipeline timeout: 30 วินาที  
- Evidence tool timeout: 15 วินาที
- SMOKE_MODE = 0 (production path, ไม่มี cache)

## Rate Limits

| Role | Limit |
|------|-------|
| Guest | 10 req/hr |
| User | 100 req/hr |
| Admin | 1000 req/hr |
