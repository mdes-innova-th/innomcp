# AI Improvement Roadmap - INNOMCP
**วันที่สร้าง:** 2026-01-05  
**เป้าหมาย:** พัฒนา AI ให้ฉลาด, ไว, ตอบตรงใจ, ลดการพึ่ง internet

---

## 🎯 วิสัยทัศน์

สร้าง AI ของ MDES ที่:
- **รู้จักตัวเอง**: รู้บทบาท, character, ประวัติการคุย
- **ฉลาด**: ตอบคำถามง่าย-กลาง-ยากได้เอง
- **เร็ว**: FastPath สำหรับคำถามง่าย, MCP สำหรับซับซ้อน
- **ลด Internet dependency**: ใช้ local tools, local data มากที่สุด
- **คล้ายมนุษย์**: ตอบตรงใจ, เข้าใจ context

---

## 📋 TODO List (25 Tasks)

### Phase 1: Core Intelligence & Memory (5 tasks)

#### ✅ Task 1.1: Session Management & Context Awareness
**Priority:** 🔴 HIGH  
**Effort:** 3-5 days  
**Status:** 🔄 IN PROGRESS

**เป้าหมาย:**
- บันทึก chat history ในแต่ละ session (sessionId)
- AI จำการคุยก่อนหน้าได้ (ใน session เดียวกัน)
- แยก session ตาม user + browser

**Implementation:**
```typescript
// Backend: innomcp-node/src/utils/sessionManager.ts
interface ChatSession {
  sessionId: string;
  userId?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    toolsUsed?: string[];
  }>;
  metadata: {
    startedAt: Date;
    lastActiveAt: Date;
    context?: Record<string, any>;
  };
}

class SessionManager {
  private sessions: Map<string, ChatSession> = new Map();
  
  getOrCreateSession(sessionId: string): ChatSession { /* ... */ }
  addMessage(sessionId: string, role, content, toolsUsed) { /* ... */ }
  getRecentMessages(sessionId: string, count = 10) { /* ... */ }
  pruneOldSessions(maxAge = 24 * 60 * 60 * 1000) { /* ... */ }
}
```

**API Changes:**
- `/api/chat/stream` รับ `sessionId` header
- ส่ง recent messages ไปให้ AI พร้อม prompt

**Success Criteria:**
- ✅ AI จำคำถาม-คำตอบก่อนหน้าได้ (test: ถาม "อะไร" หลังถาม "นายชอบอะไร")
- ✅ Session แยกตาม user/browser
- ✅ Auto-prune sessions เก่า > 24 ชั่วโมง

---

#### 🔲 Task 1.2: MDES Character Definition & System Prompt
**Priority:** 🔴 HIGH  
**Effort:** 1-2 days  
**Status:** TODO

**เป้าหมาย:**
- Define character ของ AI (เป็น AI ของ MDES)
- System prompt ที่ดี: บอกบทบาท, ความสามารถ, วิธีตอบ

**Character Profile:**
```
ชื่อ: MDES Assistant
บทบาท: AI ผู้ช่วยของหน่วยงาน MDES (Ministry of Digital Economy and Society)
ความสามารถ:
- ตอบคำถามเกี่ยวกับ MDES, นโยบายดิจิทัล, เทคโนโลยี
- ใช้ tools หลากหลาย: คำนวณ, วาดรูป, ค้นหา, OCR, แปลภาษา
- เข้าถึงข้อมูล local/cloud/database
- ไม่พึ่ง internet มากเกินไป (ใช้ local knowledge base)

บุคลิก:
- เป็นมิตร, สุภาพ, เป็นทางการพอประมาณ
- ตอบตรงประเด็น, ไม่วกวน
- ใช้ภาษาไทยชัดเจน, ถูกต้อง
- ถ้าไม่รู้ จะบอกตรงๆ และแนะนำทางเลือก
```

**Implementation:**
```typescript
// Backend: innomcp-node/src/config/systemPrompt.ts
export const SYSTEM_PROMPT = `
คุณคือ MDES Assistant - AI ผู้ช่วยของ Ministry of Digital Economy and Society

บทบาท:
- ช่วยตอบคำถามเกี่ยวกับ MDES, นโยบาย, เทคโนโลยี
- ใช้ tools ที่มี: calculator, datetime, image gen, OCR, language translation
- เข้าถึงข้อมูล: local files, database, Google Drive, NAS

หลักการตอบ:
1. ตอบตรงประเด็น, ชัดเจน, เข้าใจง่าย
2. ใช้ภาษาไทยถูกต้อง, สุภาพ
3. ถ้าคำถามง่าย ตอบเลย (ไม่ต้องใช้ tool)
4. ถ้าซับซ้อน ใช้ tool ที่เหมาะสม
5. จำประวัติการคุยในแชทนี้ได้

Context ปัจจุบัน:
{{RECENT_MESSAGES}}

Tools ที่มี:
{{AVAILABLE_TOOLS}}
`;
```

**Success Criteria:**
- ✅ AI แนะนำตัวว่าเป็น MDES Assistant
- ✅ ตอบคำถาม "นายคือใคร" ได้ถูก
- ✅ Personality สม่ำเสมอ, เป็นมิตร

---

#### 🔲 Task 1.3: FastPath Enhancement - Smart Local Response
**Priority:** 🟡 MEDIUM  
**Effort:** 2-3 days  
**Status:** TODO

**เป้าหมาย:**
- ขยาย FastPath ให้ตอบคำถามมากขึ้น (ไม่ต้องใช้ Ollama)
- เพิ่ม local knowledge base
- Pattern matching + intent detection

**Categories to Add:**
```typescript
// FastPath patterns
const FASTPATH_PATTERNS = {
  // Existing
  greeting: /^(สวัสดี|hello|hi|ดี|หวัดดี)/i,
  goodbye: /^(บาย|bye|ลาก่อน|ขอบคุณ)/i,
  
  // NEW: Self-awareness
  identity: /^(นาย|คุณ|เธอ).*(คือใคร|ชื่ออะไร|เป็นใคร)/i,
  capabilities: /^(นาย|คุณ).*(ทำอะไร|มีอะไร|สามารถ)/i,
  
  // NEW: Simple math (ไม่ต้องใช้ calculator tool)
  simpleMath: /^(\d+)\s*[\+\-\*\/]\s*(\d+)$/,
  
  // NEW: MDES info
  mdesInfo: /MDES|กระทรวง|ดิจิทัล/i,
  
  // NEW: Thai language common questions
  howAreYou: /สบายดี|เป็นไง|ยังไง/i,
  whatTime: /กี่โมง/i, // เก็บไว้เพื่อใช้ dateTimeTool
  whatDate: /วันที่|วันนี้/i,
};

const FASTPATH_RESPONSES = {
  identity: "ผม MDES Assistant ครับ - AI ผู้ช่วยของ Ministry of Digital Economy and Society 😊",
  capabilities: "ผมสามารถ:\n• ตอบคำถามทั่วไป\n• คำนวณ\n• บอกวัน-เวลา\n• วาดรูป\n• แปลภาษา\n• OCR จากภาพ\n• เชื่อมต่อ Drive/NAS\n\nลองถามผมดูครับ!",
  mdesInfo: "MDES หรือ กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม รับผิดชอบนโยบายด้านดิจิทัล, เทคโนโลยี, และการสื่อสาร",
  howAreYou: "ผมสบายดีครับ พร้อมช่วยเหลือคุณ 😊 มีอะไรให้ช่วยไหม",
};
```

**Performance Target:**
- FastPath: <50ms response
- FastPath coverage: 20-30% of questions

**Success Criteria:**
- ✅ คำถามง่าย 20-30% ตอบได้เลย ไม่ต้องใช้ Ollama
- ✅ Response time <50ms
- ✅ ตอบได้: นายคือใคร, MDES คืออะไร, 2+2, สบายดีไหม

---

#### 🔲 Task 1.4: Context Window Management
**Priority:** 🟢 LOW  
**Effort:** 2 days  
**Status:** TODO

**เป้าหมาย:**
- จัดการ context window (Ollama มีข้อจำกัด)
- Summarize ประวัติการคุยเก่า
- Keep recent messages + summary

**Implementation:**
```typescript
interface ContextWindow {
  recentMessages: Message[]; // 10 messages ล่าสุด
  summary: string; // สรุปการคุยก่อนหน้า
  importantFacts: string[]; // ข้อมูลสำคัญที่ AI ต้องจำ
}

async function buildContext(sessionId: string): Promise<string> {
  const session = sessionManager.getSession(sessionId);
  const recentMessages = session.messages.slice(-10);
  
  let context = '';
  
  // Add summary if exists
  if (session.summary) {
    context += `[สรุปการคุยก่อนหน้า]\n${session.summary}\n\n`;
  }
  
  // Add recent messages
  context += '[ประวัติการคุยล่าสุด]\n';
  for (const msg of recentMessages) {
    context += `${msg.role}: ${msg.content}\n`;
  }
  
  return context;
}
```

**Success Criteria:**
- ✅ AI จำการคุยได้ >10 messages (via summary)
- ✅ Context ไม่เกิน token limit
- ✅ Auto-summarize เมื่อ messages > 20

---

#### 🔲 Task 1.5: User Preferences & Personalization
**Priority:** 🟢 LOW  
**Effort:** 3 days  
**Status:** TODO

**เป้าหมาย:**
- จำ user preferences (language, tone, format)
- Personalized responses

**Features:**
- Preferred language: Thai/English
- Response style: formal/casual
- Output format: text/markdown/json

---

### Phase 2: Advanced Tools - Language & OCR (4 tasks)

#### 🔲 Task 2.1: OCR Tool - Image to Text
**Priority:** 🔴 HIGH  
**Effort:** 3-4 days  
**Status:** TODO

**เป้าหมาย:**
- OCR จากภาพเป็น text
- รองรับภาษาไทย-อังกฤษ
- แยก text/numbers

**Tech Stack:**
- [Tesseract.js](https://tesseract.projectnaptha.com/) - OCR engine
- หรือ Cloud OCR: Google Vision API (ถ้าต้องการความแม่นยำสูง)

**MCP Tool Definition:**
```typescript
// innomcp-server-node/src/mcp/tools/ocrTool.ts
{
  name: "ocrTool",
  description: "Extract text from image using OCR. Supports Thai and English.",
  inputSchema: {
    type: "object",
    properties: {
      imagePath: {
        type: "string",
        description: "Path to image file (local or URL)"
      },
      language: {
        type: "string",
        enum: ["tha", "eng", "tha+eng"],
        default: "tha+eng",
        description: "OCR language"
      },
      outputFormat: {
        type: "string",
        enum: ["text", "json"],
        default: "text",
        description: "Output format"
      }
    },
    required: ["imagePath"]
  }
}

// Example usage
const result = await ocrTool({
  imagePath: "/uploads/invoice.jpg",
  language: "tha+eng",
  outputFormat: "json"
});

// Result:
{
  text: "ใบเสร็จรับเงิน\nจำนวน 1,500 บาท",
  blocks: [
    { text: "ใบเสร็จรับเงิน", type: "text", confidence: 0.95 },
    { text: "1,500", type: "number", confidence: 0.98 }
  ],
  language: "tha"
}
```

**Success Criteria:**
- ✅ OCR ภาพภาษาไทยได้ >80% accuracy
- ✅ แยก text vs numbers
- ✅ Response time <3s สำหรับภาพขนาดกลาง

---

#### 🔲 Task 2.2: Language Translation Tool (Thai-English)
**Priority:** 🟡 MEDIUM  
**Effort:** 2-3 days  
**Status:** TODO

**เป้าหมาย:**
- แปลภาษา ไทย ↔ อังกฤษ
- ใช้ local model (ไม่พึ่ง internet)

**Tech Stack:**
- [Opus-MT](https://github.com/Helsinki-NLP/Opus-MT) - Local translation model
- หรือใช้ Google Translate API (fallback)

**MCP Tool Definition:**
```typescript
{
  name: "translateTool",
  description: "Translate text between Thai and English",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "Text to translate" },
      from: { type: "string", enum: ["th", "en", "auto"] },
      to: { type: "string", enum: ["th", "en"] }
    },
    required: ["text", "to"]
  }
}
```

**Success Criteria:**
- ✅ แปลได้ถูกต้อง >85%
- ✅ Local translation (ไม่ใช้ internet)
- ✅ Response time <1s

---

#### 🔲 Task 2.3: Language Detection Tool
**Priority:** 🟢 LOW  
**Effort:** 1 day  
**Status:** TODO

**เป้าหมาย:**
- ตรวจจับภาษาอัตโนมัติ
- รองรับ Thai, English, Japanese, Chinese

**Library:** [franc](https://github.com/wooorm/franc) - Language detection

---

#### 🔲 Task 2.4: Thai Text Processing Tool
**Priority:** 🟢 LOW  
**Effort:** 2 days  
**Status:** TODO

**เป้าหมาย:**
- Thai word segmentation
- Thai spell check
- Thai summarization

**Library:** [PyThaiNLP](https://github.com/PyThaiNLP/pythainlp) (Python bridge)

---

### Phase 3: Enhanced Existing Tools (5 tasks)

#### 🔲 Task 3.1: Image Generation Tool - Stable Diffusion Local
**Priority:** 🟡 MEDIUM  
**Effort:** 4-5 days  
**Status:** TODO

**เป้าหมาย:**
- สร้างภาพจาก prompt (local, ไม่ใช้ DALL-E)
- Stable Diffusion WebUI integration
- Save to local/drive/NAS

**Tech Stack:**
- [Stable Diffusion WebUI](https://github.com/AUTOMATIC1111/stable-diffusion-webui)
- API: http://localhost:7860

**MCP Tool:**
```typescript
{
  name: "imageGenTool",
  description: "Generate image from text prompt using Stable Diffusion",
  inputSchema: {
    properties: {
      prompt: { type: "string", description: "Image description" },
      negativePrompt: { type: "string" },
      width: { type: "number", default: 512 },
      height: { type: "number", default: 512 },
      steps: { type: "number", default: 20 },
      saveTo: {
        type: "array",
        items: { enum: ["local", "drive", "nas"] },
        default: ["local"]
      }
    }
  }
}
```

**Success Criteria:**
- ✅ สร้างภาพได้ quality ดี
- ✅ Response time <30s
- ✅ Save ไปหลาย location พร้อมกัน

---

#### 🔲 Task 3.2: File System Connectors - Local/Drive/NAS
**Priority:** 🔴 HIGH  
**Effort:** 5-7 days  
**Status:** TODO

**เป้าหมาย:**
- เชื่อมต่อ: Local disk, Google Drive, OneDrive, NAS
- CRUD operations: read, write, list, delete
- รองรับ file types: text, image, PDF, Office docs

**MCP Tools:**
```typescript
// Local File System
{
  name: "localFileSystem",
  description: "Manage local files",
  actions: ["read", "write", "list", "delete", "move", "copy"]
}

// Google Drive
{
  name: "googleDriveTool",
  description: "Manage Google Drive files",
  actions: ["read", "write", "list", "delete", "share"]
}

// OneDrive
{
  name: "oneDriveTool", 
  description: "Manage OneDrive files",
  actions: ["read", "write", "list", "delete", "share"]
}

// NAS (Network Attached Storage)
{
  name: "nasTool",
  description: "Manage NAS files via SMB/NFS",
  actions: ["read", "write", "list", "delete", "move"]
}
```

**Implementation:**
- Local: Node.js `fs` module
- Google Drive: [googleapis](https://www.npmjs.com/package/googleapis)
- OneDrive: [Microsoft Graph API](https://www.npmjs.com/package/@microsoft/microsoft-graph-client)
- NAS: [node-smb2](https://www.npmjs.com/package/@marsaud/smb2)

**Success Criteria:**
- ✅ อ่าน/เขียนไฟล์ทุก location ได้
- ✅ Upload/download concurrent
- ✅ Error handling robust

---

#### 🔲 Task 3.3: Web Search Aggregator - Reduce Internet Dependency
**Priority:** 🔴 HIGH  
**Effort:** 5-7 days  
**Status:** TODO

**เป้าหมาย:**
- รวม search จากหลาย source: Google, Bing, Local KB
- Cache results locally
- Prioritize local data over internet

**Architecture:**
```typescript
interface SearchResult {
  source: 'local' | 'google' | 'bing' | 'cache';
  title: string;
  snippet: string;
  url?: string;
  relevance: number;
  timestamp: Date;
}

class SearchAggregator {
  async search(query: string, options?: {
    sources?: ('local' | 'google' | 'bing')[];
    maxResults?: number;
    preferLocal?: boolean; // default: true
  }): Promise<SearchResult[]> {
    
    // 1. Search local knowledge base first
    const localResults = await this.searchLocal(query);
    
    // 2. Check cache
    const cachedResults = await this.searchCache(query);
    
    // 3. If not enough, search internet
    if (options.preferLocal === false || localResults.length < 3) {
      const webResults = await Promise.all([
        this.searchGoogle(query),
        this.searchBing(query)
      ]);
      
      // Cache for future
      await this.cacheResults(query, webResults);
    }
    
    // 4. Aggregate & rank
    return this.rankResults([...localResults, ...cachedResults, ...webResults]);
  }
}
```

**Local Knowledge Base:**
- Store common Q&A pairs
- MDES documents
- Thai government info
- Tech documentation

**Success Criteria:**
- ✅ 70%+ queries answered from local/cache
- ✅ Internet usage ลด 50%+
- ✅ Response time <2s

---

#### 🔲 Task 3.4: Calculator Tool Enhancement
**Priority:** 🟢 LOW  
**Effort:** 1-2 days  
**Status:** TODO

**เป้าหมาย:**
- เพิ่ม advanced math: trigonometry, logarithm, complex numbers
- Support units conversion
- Matrix operations

---

#### 🔲 Task 3.5: DateTime Tool Enhancement
**Priority:** 🟢 LOW  
**Effort:** 1-2 days  
**Status:** TODO

**เป้าหมาย:**
- เพิ่ม timezone support
- Thai Buddhist calendar
- Date calculations (อีก 30 วัน คือวันไหน)
- Holiday checker

---

### Phase 4: MCP Infrastructure (4 tasks)

#### 🔲 Task 4.1: MCP Server - Tool Registry & Auto-Discovery
**Priority:** 🟡 MEDIUM  
**Effort:** 3-4 days  
**Status:** TODO

**เป้าหมาย:**
- Auto-register tools จาก folder
- Tool versioning
- Health check per tool

**Implementation:**
```typescript
// innomcp-server-node/src/mcp/toolRegistry.ts
class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  
  async loadTools(toolsDir: string) {
    const files = await fs.readdir(toolsDir);
    
    for (const file of files) {
      if (file.endsWith('Tool.ts')) {
        const tool = await import(path.join(toolsDir, file));
        this.registerTool(tool.default);
      }
    }
  }
  
  registerTool(tool: ToolDefinition) {
    this.validateTool(tool);
    this.tools.set(tool.name, tool);
    console.log(`[ToolRegistry] Registered: ${tool.name}`);
  }
  
  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }
  
  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [name, tool] of this.tools) {
      results[name] = await tool.healthCheck?.() ?? true;
    }
    
    return results;
  }
}
```

**Success Criteria:**
- ✅ Tools โหลดอัตโนมัติเมื่อ server start
- ✅ Health check ทุก tool
- ✅ Logs ชัดเจนว่า tool ไหนโหลดสำเร็จ/ล้มเหลว

---

#### 🔲 Task 4.2: MCP Tool Performance Monitoring
**Priority:** 🟢 LOW  
**Effort:** 2-3 days  
**Status:** TODO

**เป้าหมาย:**
- Monitor tool usage, performance, errors
- Dashboard แสดง metrics

---

#### 🔲 Task 4.3: MCP Tool Caching
**Priority:** 🟡 MEDIUM  
**Effort:** 2-3 days  
**Status:** TODO

**เป้าหมาย:**
- Cache tool results ที่ค่อนข้าง static
- TTL per tool type

---

#### 🔲 Task 4.4: MCP Error Recovery & Retry Logic
**Priority:** 🟡 MEDIUM  
**Effort:** 2 days  
**Status:** TODO

**เป้าหมาย:**
- Auto-retry failed tool calls
- Fallback strategies

---

### Phase 5: Complex Multi-Tool Testing (3 tasks)

#### 🔲 Task 5.1: Design Complex Test Scenarios
**Priority:** 🔴 HIGH  
**Effort:** 2-3 days  
**Status:** TODO

**Test Scenario Example:**
```
User: "สร้างภาพแมวน่ารักให้หน่อย แล้วอ่าน text จากภาพ แปลเป็นไทย บวกตัวเลขที่เจอ 
      แล้ว save ไว้ที่ Drive และ NAS พร้อมค้นหาคำว่า 'แมว' ใน Facebook"

Expected AI Workflow:
1. imageGenTool("cute cat") → /uploads/cat_123.png
2. ocrTool("/uploads/cat_123.png") → "Cat 5"
3. translateTool("Cat 5", to="th") → "แมว 5"
4. calculatorTool("5 + 0") → 5 (ไม่มีตัวเลขอื่น)
5. localFileSystem.write("/tmp/result.txt", "แมว 5, ผลคำนวณ: 5")
6. googleDriveTool.upload("/tmp/result.txt")
7. nasTool.upload("/uploads/cat_123.png")
8. webSearchAggregator("แมว facebook") → results
9. รวมผลตอบกลับ user

Tools used: 8 tools
Expected time: ~45s
```

**More Scenarios:**
- OCR invoice → extract numbers → calculate total → save to DB
- Search local KB → summarize → translate → send to Slack
- Generate report → convert to PDF → upload to Drive → notify via email

---

#### 🔲 Task 5.2: Implement Complex E2E Tests
**Priority:** 🔴 HIGH  
**Effort:** 5-7 days  
**Status:** TODO

**Test Suite Structure:**
```typescript
// tests/e2e/tests/complex-scenarios.spec.ts

describe("Complex Multi-Tool Scenarios", () => {
  
  test("Scenario 1: Image Gen → OCR → Translate → Calculate → Save", async () => {
    const question = "สร้างภาพใบแจ้งหนี้ แล้วอ่านจำนวนเงิน คำนวณภาษี 7% แล้วบันทึก";
    
    const response = await askAI(question);
    
    // Verify tools used
    expect(response.toolsUsed).toContain('imageGenTool');
    expect(response.toolsUsed).toContain('ocrTool');
    expect(response.toolsUsed).toContain('calculatorTool');
    expect(response.toolsUsed).toContain('localFileSystem');
    
    // Verify files created
    expect(fs.existsSync(response.imagePath)).toBe(true);
    expect(fs.existsSync(response.resultPath)).toBe(true);
    
    // Verify calculation correct
    expect(response.finalAnswer).toMatch(/ภาษี.*7%/);
  });
  
  test("Scenario 2: Multi-location File Upload", async () => {
    // Test saving to Drive, OneDrive, NAS simultaneously
  });
  
  test("Scenario 3: Search Aggregation - Local Priority", async () => {
    // Test that local KB is searched first
  });
});
```

---

#### 🔲 Task 5.3: Tool Usage Analytics & Reporting
**Priority:** 🟢 LOW  
**Effort:** 2-3 days  
**Status:** TODO

**เป้าหมาย:**
- Report แสดง tool usage stats
- Most used tools, success rate, avg time

---

### Phase 6: UI/UX Enhancements (4 tasks)

#### 🔲 Task 6.1: Tool Indicator Balloons
**Priority:** 🟡 MEDIUM  
**Effort:** 2-3 days  
**Status:** TODO

**เป้าหมาย:**
- แสดงบอลลูนสีใต้คำตอบ AI
- สีต่างตาม tool category

**Design:**
```tsx
// Frontend: innomcp-next/src/components/ToolBadges.tsx

interface ToolBadge {
  name: string;
  category: 'calculation' | 'datetime' | 'image' | 'file' | 'search' | 'language';
  color: string;
  icon: string;
}

const TOOL_COLORS = {
  calculation: '#4CAF50',  // Green
  datetime: '#2196F3',     // Blue
  image: '#FF9800',        // Orange
  file: '#9C27B0',         // Purple
  search: '#F44336',       // Red
  language: '#00BCD4',     // Cyan
};

<div className="tool-badges">
  {toolsUsed.map(tool => (
    <span 
      key={tool.name}
      className="tool-badge"
      style={{ 
        backgroundColor: TOOL_COLORS[tool.category],
        borderRadius: '12px',
        padding: '4px 10px',
        margin: '2px',
        fontSize: '11px',
        color: 'white'
      }}
    >
      <Icon name={tool.icon} size={12} />
      {tool.name}
    </span>
  ))}
</div>
```

**Success Criteria:**
- ✅ แสดงบอลลูนทุกครั้งที่ใช้ tool
- ✅ สีสวย, อ่านง่าย
- ✅ Hover แสดง tooltip รายละเอียด tool

---

#### 🔲 Task 6.2: Response Streaming with Tool Progress
**Priority:** 🟢 LOW  
**Effort:** 3-4 days  
**Status:** TODO

**เป้าหมาย:**
- แสดง progress ขณะ AI กำลังใช้ tool
- "กำลังคำนวณ...", "กำลังสร้างภาพ...", etc.

---

#### 🔲 Task 6.3: Chat History UI
**Priority:** 🟢 LOW  
**Effort:** 2-3 days  
**Status:** TODO

**เป้าหมาย:**
- แสดงประวัติการคุยใน sidebar
- Search, filter by date/tool

---

#### 🔲 Task 6.4: Mobile Responsive Optimization
**Priority:** 🟢 LOW  
**Effort:** 3-4 days  
**Status:** TODO

---

## 📊 Summary

**Total Tasks:** 25  
**Estimated Time:** 60-85 days (2-3 months with 1 developer)

**Priority Breakdown:**
- 🔴 HIGH: 10 tasks (core features)
- 🟡 MEDIUM: 7 tasks (enhancements)
- 🟢 LOW: 8 tasks (nice-to-have)

**Phase Duration:**
- Phase 1: 10-15 days
- Phase 2: 8-12 days
- Phase 3: 13-19 days
- Phase 4: 9-12 days
- Phase 5: 9-13 days
- Phase 6: 10-14 days

---

## 🚀 Quick Start

1. **เริ่มจาก Task 1.1** - Session Management (สำคัญที่สุด)
2. **ต่อด้วย Task 1.2** - Character Definition
3. **แล้ว Task 3.1** - Image Gen Tool (user ต้องการมาก)
4. **จบด้วย Complex Tests** - Phase 5

---

## 📝 Notes

- **Internet Dependency**: เน้นลดการใช้ internet ทุก phase
- **Local First**: ทุก tool ควรมี local fallback
- **Performance**: Response time เป้าหมาย <3s สำหรับ 90% requests
- **Thai Language**: ทุก tool ต้องรองรับภาษาไทย
- **Testing**: E2E test ทุก feature ก่อน production

---

**Last Updated:** 2026-01-05  
**Status:** 🔄 Phase 1 Task 1.1 IN PROGRESS
