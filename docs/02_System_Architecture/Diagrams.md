# สถาปัตยกรรมระบบ (System Architecture)

ระบบ InnoMCP ออกแบบโดยใช้สถาปัตยกรรมแบบ **Microservices-Oriented** เพื่อความยืดหยุ่นในการขยายตัว

## แผนผังการทำงาน (High-Level Diagram)

```mermaid
graph TD
    User[Users] -->|Browser/Mobile| UI[InnoMCP Next\n(Next.js Frontend)]
    
    subgraph "Core System"
        UI -->|WebSocket/HTTP| Core[InnoMCP Node\n(Backend API)]
        Core -->|SQL| DB[(MariaDB)]
        Core -->|API| Ollama[Ollama LLM]
    end
    
    subgraph "Capabilities"
        Core <-->|MCP Protocol| MCPServer[InnoMCP Tools Server\n(Tool Provider)]
        MCPServer -->|Exec| WebSearch[Web Search]
        MCPServer -->|Exec| OCR[OCR Tesseract]
        MCPServer -->|Exec| Files[File System]
    end
```

## รายละเอียดการเชื่อมต่อ (Data Flow)

1.  **User Request**: ผู้ใช้พิมพ์ข้อความผ่านหน้าเว็บ (Next.js)
2.  **Message Routing**: Frontend ส่งข้อความผ่าน WebSocket ไปยัง `InnoMCP Node`
3.  **Intent Recognition**: `Node` วิเคราะห์ข้อความ ถ้าจำเป็นต้องใช้ Tool จะส่ง Request ไปยัง `MCP Server`
4.  **Tool Execution**: `MCP Server` ทำงานตามคำสั่ง (เช่น ค้นหาเว็บ) และส่งผลลัพธ์กลับ
5.  **LLM Generation**: `Node` รวบรวมข้อมูล + ผลลัพธ์ Tool + ประวัติแชท ส่งให้ `Ollama` ประมวลผล
6.  **Response**: AI ตอบกลับมาเป็น Stream ส่งตรงถึงหน้าจอผู้ใช้

## เทคโนโลยี (Tech Stack)

*   **Frontend**: Next.js 15, React 19, TailwindCSS v4
*   **Backend Core**: Node.js, Express, WebSocket (ws), TypeScript
*   **MCP Server**: Model Context Protocol SDK, Puppeteer (Search), Tesseract (OCR)
*   **Database**: MariaDB
*   **AI Engine**: Ollama (Local LLM)

---
*สถาปัตยกรรมนี้รองรับการเปลี่ยนโมเดล AI หรือเพิ่ม Tools ใหม่ๆ ได้โดยไม่ต้องรื้อระบบเดิม*
