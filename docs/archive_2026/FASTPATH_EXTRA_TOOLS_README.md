# 🚀 INNOMCP FastPath + Extra Tools Integration

## 📋 สรุปการพัฒนา

ระบบนี้เพิ่มความสามารถใหม่ 5 ส่วนหลักให้กับ INNOMCP:

### 1. ⚡ FastPath System (< 1 วินาที)
**วัตถุประสงค์:** ตอบคำทักทาย/คำสั้นๆ ทันทีโดยไม่ต้องเข้า AI/Tool Selection

**ไฟล์ที่สร้าง:**
- ✅ `innomcp-node/src/utils/fastPathGreeting.ts` - Dictionary + Detection Logic
- ✅ `innomcp-node/src/services/fastPathHandler.ts` - Express & WebSocket Handlers
- ✅ `innomcp-node/src/middleware/fastpathChatMiddleware.ts` - Middleware Integration
- ✅ `innomcp-node/src/applyFastPath.ts` - System-wide Integration Helper

**คำที่รองรับ (Multi-language):**
- **Greetings:** สวัสดี, hello, hi, hey, hola, bonjour, こんにちは, 안녕하세요, 你好, مرحبا
- **Identity:** นายคือใคร, who are you, what is your name
- **Thanks:** ขอบคุณ, thank you, thanks, merci, gracias, ありがとう
- **OK/Ping:** โอเค, ok, ping, test, alive
- **Emoji:** 🙂😄🙏👍 555 999!

**ENV Variables:**
```env
FASTPATH_MODE=on
FASTPATH_MAX_TEXT_LEN=400
FASTPATH_LOG_PREVIEW=140
FASTPATH_MAX_WORK_MS=15
```

---

### 2. 🎨 Image Generation Tool
**วัตถุประสงค์:** ให้ AI สร้างภาพผ่าน OpenAI/Stability/Replicate/Gateway

**ไฟล์ที่ต้องคัดลอก:**
```
docs/ADDON_CODE/imageGenTool.text 
  → innomcp-server-node/src/tools/imageGenTool.ts
```

**ENV Variables:**
```env
IMAGE_GEN_GATEWAY_URL=http://localhost:4010/v1/image/generate
IMAGE_GEN_TIMEOUT_MS=60000
IMAGE_OUT_DIR=./generated-images

# Direct providers (ถ้าไม่ใช้ gateway)
OPENAI_API_KEY=...
STABILITY_API_KEY=...
```

**MCP Tool:** `imageGenTool_generate`

---

### 3. 🔌 Connectors Tools (Local/DB/Drive/NAS)
**วัตถุประสงค์:** เชื่อมต่อกับ local files, HTTP endpoints, MySQL, Google Drive/OneDrive/NAS

**ไฟล์ที่ต้องคัดลอก:**
```
docs/ADDON_CODE/connectorsTools.txt 
  → innomcp-server-node/src/tools/connectorsTools.ts
```

**ENV Variables:**
```env
# Local file access allowlist
FS_ALLOWLIST=c:/Users/USER-NT/DEV/innomcp/innomcp-node/data,c:/path/to/nas

# MySQL (read-only)
MYSQL_URL=mysql://user:pass@host:3306/dbname
MYSQL_READONLY=true

# Gateway for Drive/OneDrive/NAS OAuth
CONNECTOR_GATEWAY_URL=http://localhost:4010
CONNECTOR_TIMEOUT_MS=25000
```

**MCP Tools:**
- `localDataTool_http_get` - GET ข้อมูลจาก HTTP endpoint
- `localDataTool_file_read` - อ่านไฟล์จาก allowlist paths
- `dbTool_mysql_query_readonly` - Query MySQL (SELECT only)
- `driveTool_list` - List files จาก Google Drive/OneDrive/NAS
- `driveTool_read` - อ่านไฟล์จาก Google Drive/OneDrive/NAS

---

### 4. 🌐 Web Search Aggregator Tool
**วัตถุประสงค์:** รวมผลค้นหาจากหลายแหล่ง (Wikipedia/Google/YouTube/Social) ผ่าน Gateway

**ไฟล์ที่ต้องคัดลอก:**
```
docs/ADDON_CODE/webSearchAggregatorTool.txt 
  → innomcp-server-node/src/tools/webSearchAggregatorTool.ts
```

**ENV Variables:**
```env
WEB_AGG_GATEWAY_URL=http://localhost:4010
WEB_AGG_TIMEOUT_MS=20000
WEB_AGG_TOPK=5
WEB_AGG_DEFAULT_SOURCES=wikipedia,gateway
```

**MCP Tool:** `webAggTool_search_multi_source`

---

### 5. 🖥️ Python Test Controller GUI
**วัตถุประสงค์:** ควบคุมการรัน E2E tests แบบมืออาชีพด้วย GUI

**ไฟล์ที่สร้าง:**
- ✅ `tests/e2e/test_controller_gui.py` - Professional tkinter GUI

**Features:**
- ✅ Always-on-top floating window
- ✅ Select & run multiple *.spec.ts files
- ✅ Real-time progress monitoring
- ✅ Live log streaming with color coding
- ✅ Test statistics (Total/Passed/Failed/Running)
- ✅ Stop tests gracefully
- ✅ Open results folder

**วิธีรัน:**
```bash
# ติดตั้ง tkinter (ถ้ายังไม่มี)
pip install tk

# รัน GUI
python tests/e2e/test_controller_gui.py
```

---

## 📦 ขั้นตอนการติดตั้งที่เหลือ

### 1. คัดลอกไฟล์ Tools
```bash
# คัดลอกไฟล์จาก docs/ADDON_CODE ไปยัง innomcp-server-node/src/tools/
cp docs/ADDON_CODE/imageGenTool.text innomcp-server-node/src/tools/imageGenTool.ts
cp docs/ADDON_CODE/connectorsTools.txt innomcp-server-node/src/tools/connectorsTools.ts
cp docs/ADDON_CODE/webSearchAggregatorTool.txt innomcp-server-node/src/tools/webSearchAggregatorTool.ts
```

### 2. อัพเดท registerExtraTools.ts
แก้ไข `innomcp-server-node/src/tools/registerExtraTools.ts`:
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerImageGenTool } from "./imageGenTool";
import { registerConnectorsTools } from "./connectorsTools";
import { registerWebSearchAggregatorTool } from "./webSearchAggregatorTool";

export function registerExtraTools(server: McpServer) {
  registerImageGenTool(server);
  registerConnectorsTools(server);
  registerWebSearchAggregatorTool(server);
}
```

### 3. เพิ่ม Dependencies
```bash
# ใน innomcp-server-node
cd innomcp-server-node
npm install mysql2
```

### 4. Integrate FastPath ใน Backend
แก้ไข `innomcp-node/src/app.ts` หรือ main entry point:
```typescript
import { applyFastPathToExpress } from "./applyFastPath";

// หลังสร้าง Express app
const app = express();

// เสียบ FastPath middleware (ต้องวางก่อน chat route จริง)
applyFastPathToExpress(app, "/api/chat");

// จากนั้นค่อยเพิ่ม chat handler ตัวจริง
app.post("/api/chat", chatHandler);
```

### 5. Register Tools ใน MCP Server
แก้ไข `innomcp-server-node/src/index.ts`:
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerExtraTools } from "./tools/registerExtraTools";

const server = new McpServer({...});

// Register extra tools
registerExtraTools(server);
```

---

## 🧪 การ Test

### 1. ทดสอบ FastPath (ไม่ต้อง restart services)
```bash
# รัน GUI Controller
python tests/e2e/test_controller_gui.py

# หรือรันด้วย Playwright CLI
npx playwright test tests/e2e/tests/fastpath-and-extra-tools.spec.ts --reporter=list
```

**Expected Results:**
- `สวัสดี` → ตอบภายใน < 1s ✅
- `hello` → ตอบภายใน < 1s ✅
- `นายคือใคร` → ตอบภายใน < 1s ✅
- `ping` → ตอบภายใน < 1s ✅

### 2. ทดสอบ Tools (ต้อง restart MCP server)
ใน test file uncomment tools tests ที่ต้องการ:
```typescript
// Uncomment เมื่อ copy tools เรียบร้อยแล้ว
{ 
  group: "IMAGE_GEN", 
  question: "สร้างภาพแมวใส่ชุดอวกาศ", 
  ...
},
```

---

## 📊 สถาปัตยกรรม

```
┌─────────────────────────────────────────────────────────────┐
│                    User Browser                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Next.js Frontend    │
         │   (innomcp-next)      │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Node.js Backend     │◄──── ⚡ FastPath Middleware
         │   (innomcp-node)      │      (< 1s response)
         └───────────┬───────────┘
                     │
                     ├──► 🤖 AI/LLM (for complex queries)
                     │
                     ▼
         ┌───────────────────────┐
         │   MCP Server          │
         │   (innomcp-server-)   │
         │                       │
         │   📦 Tools:           │
         │   • imageGenTool      │
         │   • connectorsTools   │
         │   • webAggTool        │
         └───────────────────────┘
```

---

## 🎯 ประโยชน์ที่ได้

### 1. ⚡ FastPath
- **ลดภาระ AI:** ไม่ต้องเรียก LLM สำหรับคำทักทาย
- **ประหยัด Cost:** ไม่มี API call cost สำหรับ small-talk
- **UX ดีขึ้น:** ตอบทันที < 1 วินาที

### 2. 🎨 Image Generation
- **AI ที่ครบ:** Text + Image ในที่เดียว
- **Flexible:** รองรับหลาย providers
- **Safe:** ใช้ gateway ซ่อน API keys

### 3. 🔌 Connectors
- **Enterprise-ready:** เชื่อมต่อข้อมูลองค์กร
- **Secure:** Allowlist + Read-only guards
- **Versatile:** Local/DB/Drive/NAS ในชุดเดียว

### 4. 🌐 Web Search
- **ข้อมูลล่าสุด:** ดึงจาก internet realtime
- **Multi-source:** รวมหลายแหล่งในครั้งเดียว
- **Cached:** Gateway handle rate limits

### 5. 🖥️ GUI Controller
- **Professional:** ควบคุม tests แบบมืออาชีพ
- **Real-time:** เห็นผลทันที
- **Easy:** ไม่ต้องจำคำสั่ง CLI

---

## ⚙️ Configuration Reference

### FastPath
```env
FASTPATH_MODE=on                    # on | off
FASTPATH_MAX_TEXT_LEN=400          # ความยาวข้อความสูงสุด
FASTPATH_MAX_WORK_MS=15            # timeout สำหรับ extra lookups
FASTPATH_DICT_PATH=./config/...   # dictionary file (optional)
```

### Image Gen
```env
IMAGE_GEN_GATEWAY_URL=...          # gateway URL (recommended)
IMAGE_GEN_TIMEOUT_MS=60000         # timeout
IMAGE_OUT_DIR=./generated-images   # output directory
```

### Connectors
```env
FS_ALLOWLIST=path1,path2           # comma-separated allowlist
MYSQL_URL=mysql://...              # MySQL connection string
MYSQL_READONLY=true                # force read-only queries
CONNECTOR_GATEWAY_URL=...          # gateway for Drive/OneDrive/NAS
```

### Web Aggregator
```env
WEB_AGG_GATEWAY_URL=...            # gateway URL
WEB_AGG_TIMEOUT_MS=20000           # timeout
WEB_AGG_TOPK=5                     # จำนวนผลลัพธ์
WEB_AGG_DEFAULT_SOURCES=...        # default sources
```

---

## 🐛 Troubleshooting

### FastPath ไม่ทำงาน
1. ตรวจสอบ `FASTPATH_MODE=on` ใน .env
2. ตรวจสอบว่า middleware ถูกเสียบก่อน chat handler
3. ดู log: `[FastPath] hit=...` ใน backend logs

### Tools ไม่ถูกเรียก
1. ตรวจสอบว่าคัดลอกไฟล์ tools เรียบร้อย
2. ตรวจสอบ `registerExtraTools()` ถูกเรียกใน MCP server init
3. Restart MCP server: `npm run dev` ใน innomcp-server-node

### GUI ไม่แสดง
1. ติดตั้ง tkinter: `pip install tk`
2. รันจาก root directory: `python tests/e2e/test_controller_gui.py`
3. ตรวจสอบ path ใน GUI code ถูกต้อง

---

## 📚 เอกสารเพิ่มเติม

- **FastPath Dictionary:** `docs/ADDON_CODE/fastpath.config.txt`
- **Gateway Contracts:** `docs/ADDON_CODE/fastpath.config.txt` (ด้านล่าง)
- **Tool Implementation:** `docs/ADDON_CODE/*.txt`

---

## ✅ Checklist

- [x] FastPath System created
- [x] FastPath Middleware integration done
- [x] Test Controller GUI created
- [x] ENV variables updated
- [x] Test file improved (Windows paths)
- [ ] **TODO:** Copy tool files from ADDON_CODE to innomcp-server-node/src/tools/
- [ ] **TODO:** Uncomment imports in registerExtraTools.ts
- [ ] **TODO:** Integrate FastPath in innomcp-node/src/app.ts
- [ ] **TODO:** Call registerExtraTools() in innomcp-server-node/src/index.ts
- [ ] **TODO:** Install mysql2: `npm install mysql2`
- [ ] **TODO:** Restart all 3 services
- [ ] **TODO:** Test with GUI Controller

---

**Created:** 2026-01-05  
**Status:** ✅ Core files ready, manual integration steps remaining  
**Next:** Follow installation steps above to complete integration
