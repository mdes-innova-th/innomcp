# Chat Components Reference (A-M)

| Component | Purpose | Key Props | Status |
|----------|---------|-----------|--------|
| **AgentAvatar** | แสดงอวาตาร์ของเอเจนต์ AI / Displays AI agent avatar | `agentId`, `size`, `className` | core |
| **AgentStepsView** | แสดงขั้นตอนการทำงานของเอเจนต์ / Shows agent task steps | `steps: Step[]`, `currentStep: number` | optional |
| **ChatInput** | ช่องป้อนข้อความสนทนา / Basic message input field | `onSend: (text: string) => void`, `placeholder`, `disabled` | core |
| **ChatInputEnhanced** | อินพุตขั้นสูงพร้อมปุ่มแนบไฟล์และคำแนะนำ / Enhanced input with attachments & suggestions | `onSend`, `onAttach`, `suggestions`, `disabled` | optional |
| **ChatMessage** | ข้อความสนทนาพร้อมเนื้อหา, เวลา, ชื่อผู้ส่ง / Single chat message with content, time, sender | `message: Message`, `isOwn`, `agentName?`, `timestamp` | core |
| **ChatPage** | หน้าหลักแชท จัดเลย์เอาต์ sidebar และพื้นที่ข้อความ / Main chat page layout: sidebar + chat area | `messages`, `onSend`, `loading`, `sidebarContent` | core |
| **ChatSidebar** | แถบด้านข้างแสดงประวัติการสนทนา / Conversation history sidebar | `conversations`, `activeConversation`, `onSelect` | core |
| **ChatWelcomeHero** | หน้าจอต้อนรับพร้อมข้อความแนะนำและฟีเจอร์ / Welcome screen with prompts & features | `onPromptClick`, `features` | optional |
| **CollapsibleAgentWrapper** | ห่อหุ้มรายละเอียดเอเจนต์ที่ย่อ/ขยายได้ / Collapsible container for agent details | `agentName`, `collapsed`, `onToggle`, `children` | optional |
| **DateDivider** | ตัวคั่นวันที่ระหว่างข้อความ / Date separator between message groups | `date: Date`, `format?: string` | core |
| **FollowUpSuggestions** | ข้อความแนะนำต่อเนื่องจาก AI / AI-generated follow‑up suggestions | `suggestions: string[]`, `onSelect: (text: string) => void` | optional |
| **GovernmentQuickActions** | ปุ่มดำเนินการด่วนด้านภาครัฐ / Quick‑action buttons for government services | `actions: Action[]`, `onAction: (actionId: string) => void` | optional |
| **InlineFeedbackBar** | แถบให้คะแนน (ถูกใจ/ไม่ถูกใจ) ในข้อความ / Inline feedback bar (like/dislike) | `messageId`, `onFeedback`, `feedbackStatus` | optional |
| **ManusWorkspacePanel** | แผงแสดงผล workspace แบบ Manus / Manus‑style artifact/workspace panel | `content`, `language`, `onRun` | optional |
| **MDESBrandHeader** | ส่วนหัวแสดงตราสัญลักษณ์ MDES / Header with MDES brand logo & title | `logo`, `title` | core |
| **MDESModelPicker** | ตัวเลือกโมเดล AI / AI model selector dropdown | `models`, `selectedModel`, `onSelect`, `disabled` | optional |
| **MDESStreamIndicator** | แสดงสถานะกำลังตอบกลับ (พิมพ์…) / Streaming response indicator | `isStreaming`, `agentName?` | core |
| **MessageThread** | มุมมองแสดงข้อความภายในเธรด / Threaded message view with replies & reactions | `messages: Message[]`, `onReply`, `onReact` | core |

**หมายเหตุ / Note:** Components marked *core* are essential for the chat interface to function; *optional* components are feature enhancements and can be omitted without breaking the basic chat flow.