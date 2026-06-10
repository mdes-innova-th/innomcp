Make sure the backend is running on `http://localhost:3011` (see [innomcp-node](link-to-backend-repo) for setup).

---

## ⚙️ Provider Configuration

**ค่าเริ่มต้น (Default):** MDES Ollama  

- URL: `https://ollama.mdes-innova.online`
- API key: *ไม่จำเป็น* (internal reverse‑proxy)
- Models: `mistral`, `llama3.2`, `gemma2:27b`, ฯลฯ

**เพิ่ม Custom Provider:**  
คลิกปุ่ม ⚙️ ที่ header → **Provider** tab  
กรอก:

- ชื่อ provider
- Base URL
- API Key
- รายชื่อ models

รองรับ presets สำเร็จรูป: OpenAI, Anthropic, Groq, Ollama (self‑hosted) และอื่น ๆ  
All configuration is stored in the browser’s localStorage (no backend persistence required).

---

## 📁 Project Structure (simplified)