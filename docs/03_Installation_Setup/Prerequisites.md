# สิ่งที่ต้องเตรียม (Prerequisites)

ก่อนเริ่มติดตั้ง InnoMCP โปรดตรวจสอบให้แน่ใจว่าเครื่องของคุณมีสิ่งเหล่านี้:

## 1. ซอฟต์แวร์พื้นฐาน (Required Software)
*   **Git**: สำหรับดึงโค้ดจาก Repository
*   **Node.js**: เวอร์ชั่น 18.0 ขึ้นไป (แนะนำ v20 LTS)
*   **Docker Desktop**: สำหรับรัน Database และ Services ต่างๆ ง่ายๆ
*   **Ollama**: โปรแกรมรัน AI Model (ต้องติดตั้งบนเครื่อง Host)

## 2. ฮาร์ดแวร์ที่แนะนำ (Recommended Hardware)
เนื่องจากต้องรัน AI Model บนเครื่อง:
*   **RAM**: อย่างน้อย 16GB (แนะนำ 32GB)
*   **GPU**: NVIDIA RTX 3060 ขึ้นไป (VRAM 8GB+) จะทำงานลื่นมาก
*   **Storage**: SSD พื้นที่ว่างอย่างน้อย 20GB (สำหรับ Model และ Docker Image)

## 3. การเตรียม AI Model (Ollama Setup)
1.  ติดตั้ง Ollama จาก [ollama.com](https://ollama.com)
2.  เปิด Terminal แล้วดึงโมเดลที่ต้องการใช้งาน:
    ```bash
    ollama pull llama3
    ollama pull mistral
    ```
3.  ตรวจสอบว่า Ollama รันอยู่ที่ Port 11434 (Default)

---
*เมื่อเตรียมครบแล้ว ไปต่อที่ขั้นตอนการติดตั้งได้เลย*
