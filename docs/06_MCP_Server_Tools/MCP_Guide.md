# คู่มือ MCP Tools (MCP Server)

**InnoMCP Server Node** ให้บริการ "เครื่องมือพิเศษ" ที่ AI สามารถหยิบไปใช้แก้ปัญหาให้ผู้ใช้ได้

## หลักการทำงาน (How It Works)
เราใช้มาตรฐาน **Model Context Protocol (MCP)** ในการสื่อสาร:
1.  Frontend/Backend ส่งคำขอ List Tools (`mcp.listTools`)
2.  Server ตอบกลับรายการเครื่องมือที่ทำได้
3.  เมื่อ AI ตัดสินใจใช้ Tool จะส่งคำสั่ง Execute (`mcp.callTool`)
4.  Server รันคำสั่งจริงแล้วส่งผลลัพธ์กลับ

## รายการเครื่องมือที่มี (Available Tools)

### 1. `web_search`
*   **หน้าที่**: ค้นหาข้อมูลล่าสุดจาก Google/Bing
*   **Input**: `query` (คำค้นหา)
*   **Output**: สรุปเนื้อหาจาก 5 เว็บไซต์แรก

### 2. `read_website`
*   **หน้าที่**: อ่านเนื้อหาในหน้าเว็บแบบละเอียด
*   **Input**: `url`
*   **Output**: เนื้อหา text ทั้งหมดในหน้านั้น (ตัดโฆษณาออก)

### 3. `ocr_image`
*   **หน้าที่**: อ่านข้อความจากรูปภาพ (รองรับภาษาไทย/อังกฤษ)
*   **Input**: `imageUrl` หรือ `base64`
*   **Output**: ข้อความที่แกะได้ (String)

### 4. `read_file`
*   **หน้าที่**: อ่านไฟล์เอกสาร (PDF, DOCX, TXT)
*   **Input**: `filePath`
*   **Output**: เนื้อหาในไฟล์

### 5. `generate_chart`
*   **หน้าที่**: สร้างไฟล์รูปภาพกราฟ/แผนภูมิ
*   **Input**: `data` (JSON), `type` (bar, line, pie)
*   **Output**: URL ของรูปภาพกราฟที่สร้างเสร็จ

---
*การเพิ่ม Tool ใหม่ทำได้ง่ายๆ เพียงเขียน Function ใน `innomcp-server-node/src/tools` และลงทะเบียนใน index*
