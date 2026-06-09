# PROMPT หลักสำหรับสั่งสร้างระบบ

คุณคือ **ทีม senior full-stack AI product engineers, system architects, UX designers, security engineers, DevOps engineers และ AI agent framework specialists** ที่ทำงานร่วมกันเป็นกลุ่ม agents ระดับสูง หน้าที่ของคุณคือขยายและปรับปรุงระบบ **InnoMCP Personal AI Agent Workspace** ที่มีอยู่แล้ว เพื่อให้กลายเป็นแพลตฟอร์ม AI Agent ที่มีประสิทธิภาพสูง รองรับ MCP Tools + RAG + Stream Processing ให้เป็นระบบที่ใช้งานได้จริง รันได้จริง แก้ไขต่อได้จริง และเชื่อมต่อกับ **LLM/model ของฉันเอง** และ**MCP Servers** ได้

ระบบนี้ต้องเป็น AI workspace ที่ผู้ใช้สามารถพิมพ์สั่งงานด้วยภาษาธรรมชาติ แล้วระบบจะสร้าง task, วางแผน, แตกงานเป็น phases, ส่งงานให้ sub-agents, เรียกใช้ tools, แสดงหน้าจอการทำงานแบบ real-time, เก็บประวัติ, แนบไฟล์, สร้าง artifact และส่งผลลัพธ์กลับมาในรูปแบบที่อ่านง่าย เหมาะสำหรับงานส่วนตัว เช่น research, coding, automation, data analysis, document generation, web app building และการจัดการไฟล์ใน workspace

ห้ามคัดลอกชื่อ แบรนด์ โลโก้ ข้อความเฉพาะ โค้ด proprietary asset หรือ visual identity เฉพาะของผลิตภัณฑ์ใด ให้สร้างชื่อและ visual language ใหม่ของเราเอง แต่ให้ยึด **หลักการประสบการณ์ผู้ใช้** ดังนี้: เรียบง่าย สะอาด เห็นกระบวนการทำงานของ agents ชัดเจน มี sidebar สำหรับงานและโปรเจกต์ มีพื้นที่ chat หลัก มีพื้นที่ task activity/agent screen ที่แสดงว่า agents กำลังทำอะไร มีระบบ artifact preview และใช้งานง่ายแม้ผู้ใช้ไม่ใช่ programmer

---

## 1. Product Vision

สร้าง web application ชื่อชั่วคราวว่า **Private Agent Studio** โดยระบบต้องมีแนวคิดหลักคือ “ผู้ช่วย AI ส่วนตัวที่ไม่ได้แค่ตอบแชต แต่ลงมือทำงานเป็นขั้นตอนให้เห็นได้” ผู้ใช้ต้องรู้สึกว่ากำลังทำงานร่วมกับทีม agents ขนาดเล็กที่มีความสามารถหลากหลาย ไม่ใช่ chatbot ธรรมดา

ระบบต้องรองรับ workflow ต่อไปนี้อย่างน้อย:

| Workflow | คำอธิบาย |
|---|---|
| Conversational Task Intake | ผู้ใช้พิมพ์คำสั่ง ระบบตีความเป้าหมาย ข้อจำกัด และผลลัพธ์ที่ต้องส่งมอบ |
| Plan Generation | ระบบสร้างแผนงานเป็น phases พร้อมสถานะ current, pending, completed, blocked |
| Live Agent Activity | ระหว่างทำงานต้องแสดง stream ว่า agent กำลังคิด วางแผน ใช้เครื่องมือ อ่านไฟล์ เขียนไฟล์ หรือรันคำสั่งใด |
| Tool Execution | ระบบมีเครื่องมือพื้นฐาน เช่น file manager, shell runner, web fetcher, code editor, browser-like fetch, artifact generator |
| Model Adapter | ผู้ใช้สามารถตั้งค่า model endpoint ของตนเองได้ เช่น OpenAI-compatible API, local LLM, Ollama, vLLM, LM Studio หรือ custom HTTP API |
| Artifact Workspace | ผลลัพธ์เช่น Markdown, code, JSON, CSV, image, chart, HTML preview ต้องเก็บเป็น artifacts และเปิดดูได้ |
| Project Memory | เก็บประวัติ task, ไฟล์, settings, preferences และ reusable prompts แยกตาม project |
| Human-in-the-loop | หากต้องยืนยันก่อนทำงานเสี่ยง เช่น ลบไฟล์ รันคำสั่งอันตราย หรือส่งข้อมูลออกนอกเครื่อง ต้องถามผู้ใช้ก่อน |

---

## 2. Target Users และ Use Cases

ระบบนี้ออกแบบให้ฉันใช้ส่วนตัว จึงต้องให้ความสำคัญกับความเร็ว ความเป็นส่วนตัว และการควบคุม model เองมากกว่าการทำระบบ enterprise ขนาดใหญ่ แต่โครงสร้างต้องดีพอให้ขยายเป็น multi-user ในอนาคตได้

| Use Case | ตัวอย่างคำสั่งจากผู้ใช้ | ผลลัพธ์ที่ต้องได้ |
|---|---|---|
| Research | “หาข้อมูลตลาด SaaS สำหรับร้านอาหารไทยแล้วทำรายงาน” | รายงาน Markdown พร้อมแหล่งอ้างอิงและ artifact |
| Coding | “สร้าง landing page สำหรับ app นี้” | โค้ด frontend, preview และคำอธิบายวิธีรัน |
| Data Analysis | “วิเคราะห์ไฟล์ CSV นี้แล้วสรุป insight” | ตาราง, chart, summary และไฟล์ผลลัพธ์ |
| Automation | “ตั้ง workflow เช็กข่าวทุกเช้า” | task template, scheduler design และ execution log |
| Document Generation | “เขียน proposal ให้ลูกค้า” | เอกสารฉบับสมบูรณ์พร้อมเวอร์ชันที่แก้ไขได้ |
| Personal Workspace | “จำ project นี้ไว้ว่าใช้ model X และ style Y” | project memory และ reusable settings |

---

## 3. High-Level Technical Architecture

ให้สร้างระบบแบบ modular monorepo ที่สามารถรัน local ได้ก่อน แล้วจึง deploy ได้ภายหลัง สถาปัตยกรรมต้องแบ่งเป็น frontend, backend API, agent runtime, tool sandbox, database, storage และ model gateway อย่างชัดเจน

| Layer | หน้าที่ | เทคโนโลยีที่แนะนำ |
|---|---|---|
| Frontend | UI workspace, chat, live activity, artifact preview | Next.js หรือ React + TypeScript + TailwindCSS |
| Backend API | จัดการ auth, projects, tasks, messages, artifacts, settings | FastAPI หรือ Node.js/NestJS |
| Agent Runtime | plan, execute, reflect, call tools, manage sub-agents | Python service หรือ TypeScript worker |
| Model Gateway | เชื่อมต่อ model ของผู้ใช้ผ่าน adapter เดียว | OpenAI-compatible client + custom provider interface |
| Tool Sandbox | รัน shell, อ่านเขียนไฟล์, web fetch, code execution แบบจำกัดสิทธิ์ | Docker sandbox หรือ isolated workspace directory |
| Database | เก็บ users, projects, tasks, messages, plans, tool calls | PostgreSQL หรือ SQLite สำหรับ local-first MVP |
| Realtime | stream token, agent events, logs, task status | WebSocket หรือ Server-Sent Events |
| Storage | เก็บ artifacts, uploaded files, generated files | Local filesystem ก่อน แล้วค่อยรองรับ S3-compatible storage |

ให้เริ่มจาก MVP ที่รันได้ในเครื่องเดียวก่อน โดยใช้ SQLite และ local filesystem ได้ จากนั้นออกแบบ abstraction ให้เปลี่ยนเป็น PostgreSQL และ object storage ได้ง่าย

---

## 4. Model Gateway Requirements

ระบบต้องไม่ผูกกับ provider ใด provider หนึ่ง ให้สร้าง **Model Gateway** ที่ทำหน้าที่เป็นตัวกลางระหว่าง agent runtime กับ model ของฉันเอง โดยรองรับ provider เหล่านี้:

| Provider Type | ตัวอย่างค่าตั้งค่า | หมายเหตุ |
|---|---|---|
| OpenAI-compatible | `baseUrl`, `apiKey`, `modelName` | ใช้ได้กับ LLM gateway จำนวนมาก |
| Ollama | `http://localhost:11434`, `modelName` | สำหรับ local model |
| vLLM | custom OpenAI-compatible endpoint | สำหรับ self-host GPU server |
| LM Studio | local OpenAI-compatible endpoint | สำหรับใช้งานบนเครื่องส่วนตัว |
| Custom HTTP | endpoint, headers, request mapping, response mapping | สำหรับ model API ของฉันเอง |

ต้องมีหน้า Settings ให้ผู้ใช้กรอก model endpoint และทดสอบ connection ได้ ต้องมีระบบ fallback model และต้อง log ค่า latency, token usage หาก provider ส่งข้อมูลมา ห้าม hard-code API key ในโค้ด ให้ใช้ environment variables และ encrypted local settings เท่าที่ทำได้

ตัวอย่าง environment variables:

```bash
MODEL_PROVIDER=openai_compatible
MODEL_BASE_URL=http://localhost:8000/v1
MODEL_API_KEY=replace-with-my-key
MODEL_NAME=my-private-model
EMBEDDING_MODEL_NAME=my-embedding-model
DATABASE_URL=sqlite:///./data/app.db
WORKSPACE_ROOT=./workspace
```

---

## 5. Agent System Design

ระบบต้องมี agent หลักชื่อ **Orchestrator Agent** ทำหน้าที่รับคำสั่งผู้ใช้ วิเคราะห์ intent สร้าง plan และเลือก sub-agents ตามงาน ห้ามให้ agent ทำงานแบบสุ่มหรือ opaque ต้องแสดงสถานะและเหตุผลเชิงสรุปให้ผู้ใช้เห็นแบบเข้าใจง่าย

| Agent | หน้าที่ |
|---|---|
| Orchestrator Agent | รับคำสั่ง วางแผน คุมงานทั้งหมด ตัดสินใจเรียก sub-agent และ tools |
| Research Agent | ค้นคว้า สรุปข้อมูล จัดแหล่งอ้างอิง ตรวจความน่าเชื่อถือ |
| Developer Agent | อ่าน เขียน แก้ไขโค้ด สร้างโปรเจกต์ รัน tests และสรุปการเปลี่ยนแปลง |
| Data Agent | วิเคราะห์ CSV/JSON/Excel สร้างตารางและ visualization |
| Writer Agent | เขียนรายงาน เอกสาร proposal บทความ และ final response |
| QA Agent | ตรวจผลลัพธ์ ตรวจ requirements ตรวจ hallucination และเสนอการแก้ไข |
| Tool Agent | เป็น wrapper สำหรับการเรียก tools ที่ต้องควบคุมสิทธิ์และบันทึก log |

Agent runtime ต้องมี loop ขั้นต่ำดังนี้:

```text

1. Receive user message
2. Classify task type and risk level
3. Create or update task plan
4. Select tools and sub-agents
5. Execute phase by phase
6. Stream events to UI
7. Save messages, tool calls, files, and artifacts
8. Run QA/reflection before final response
9. Deliver final answer with links to artifacts



6. Tool System Requirements
ให้สร้าง tool interface แบบ typed schema เพื่อให้ agents เรียกใช้งานอย่างปลอดภัย ทุก tool call ต้องมี id, taskId, toolName, input, status, startedAt, endedAt, stdout, stderr, artifactIds และ riskLevel

Tool	ความสามารถ	ข้อจำกัดความปลอดภัย
File Tool	read, write, append, edit, list files	จำกัดใน workspace root เท่านั้น
Shell Tool	run command, install dependencies, run tests	ต้อง block คำสั่งอันตรายและขออนุมัติเมื่อเสี่ยง
Web Fetch Tool	fetch URL, extract text, save source	ต้องไม่รันโค้ดจากเว็บอัตโนมัติ
Code Tool	format, lint, run unit tests	จำกัด path และ timeout
Artifact Tool	create markdown, csv, chart, html, zip	ทุก artifact ต้องมี metadata
Memory Tool	save preference, project note, reusable context	ต้องแสดงให้ผู้ใช้แก้ไข/ลบได้
ต้องมี policy engine ง่าย ๆ สำหรับอนุมัติคำสั่งเสี่ยง เช่น rm -rf, การส่งไฟล์ออกนอกเครื่อง, การเขียนทับไฟล์สำคัญ, การติดตั้ง package จากแหล่งไม่รู้จัก หรือการเรียก API ภายนอกที่ใช้ข้อมูลส่วนตัว



7. UI/UX Specification
ออกแบบ UI ให้เป็น agent workspace ที่สะอาด ใช้งานง่าย และให้ความรู้สึกว่ามีระบบกำลังทำงานอยู่เบื้องหลังอย่างโปร่งใส ทำหน้าตาเลียนแบบ manus.im  ให้สร้าง design system ใหม่ของเราเอง

หน้าจอหลักต้องประกอบด้วย:

Area	รายละเอียด
Left Sidebar	รายชื่อ projects, recent tasks, quick actions, settings
Main Chat Panel	บทสนทนากับผู้ใช้และ final answers
Agent Activity Panel	แสดง plan, current phase, tool calls, sub-agent status, logs แบบ real-time
Artifact Panel	preview ไฟล์ Markdown, code, tables, charts, HTML, downloads
Command Bar	ช่องพิมพ์คำสั่ง รองรับแนบไฟล์ เลือก project เลือก model และโหมดการทำงาน
Top Status Bar	สถานะ model, connection, running tasks, token/latency summary
โทนการออกแบบควรเป็น modern, minimal, calm, professional ใช้ spacing เยอะ อ่านง่าย รองรับ light/dark mode และ responsive layout สำหรับจอ desktop เป็นหลัก แต่ต้องเปิดบน tablet ได้

หน้าจอสำคัญที่ต้องสร้าง
Screen	Requirement
Dashboard	แสดง recent projects, running tasks, pinned artifacts, model status
Project Workspace	หน้าหลักที่มี chat + activity + artifacts
Task Detail	แสดง timeline, plan, tool calls, files, final output
Artifact Viewer	preview และ download artifact
Model Settings	ตั้งค่า model endpoint, test connection, default model
Tool Permissions	ตั้งค่า allow/deny/ask for confirmation สำหรับ tools
Memory Manager	ดู แก้ไข ลบ project memory และ user preferences


8. Realtime Agent Activity
หนึ่งในหัวใจของระบบคือ ผู้ใช้ต้องเห็นว่า agents กำลังทำอะไรระหว่างรอคำตอบ ไม่ใช่เห็นแค่ loading spinner ให้สร้าง event stream ที่ส่งสถานะต่อไปนี้จาก backend ไป frontend:

Event Type	ตัวอย่างข้อความใน UI
task.created	“สร้างงานใหม่แล้ว”
plan.created	“วางแผนงาน 5 ขั้นตอน”
phase.started	“เริ่มค้นคว้าข้อมูล”
agent.started	“Research Agent กำลังรวบรวมแหล่งข้อมูล”
tool.started	“กำลังอ่านไฟล์ sales.csv”
tool.completed	“วิเคราะห์ไฟล์เสร็จแล้ว พบ 12 columns”
artifact.created	“สร้างรายงาน summary.md แล้ว”
approval.required	“ต้องการอนุมัติก่อนรันคำสั่งนี้”
qa.started	“QA Agent กำลังตรวจผลลัพธ์”
task.completed	“งานเสร็จสมบูรณ์”
UI ต้องมี timeline ที่ collapse/expand ได้ มี badge สีแสดงสถานะ running, completed, failed, blocked และต้องคลิกดูรายละเอียด tool input/output ได้ แต่ต้อง mask secret เช่น API key อัตโนมัติ



9. Data Model ขั้นต้น
ให้ออกแบบ database schema อย่างน้อยดังนี้:

Table	Fields หลัก
users	id, email, display_name, created_at
projects	id, user_id, name, description, created_at, updated_at
tasks	id, project_id, title, status, risk_level, created_at, updated_at
messages	id, task_id, role, content, metadata_json, created_at
plans	id, task_id, version, status, created_at
plan_steps	id, plan_id, title, description, status, order_index
agent_events	id, task_id, event_type, content, metadata_json, created_at
tool_calls	id, task_id, tool_name, input_json, output_json, status, risk_level, created_at
artifacts	id, task_id, name, type, path, mime_type, metadata_json, created_at
model_settings	id, user_id, provider, base_url, model_name, encrypted_api_key, created_at
memories	id, project_id, scope, key, value, created_at, updated_at
ต้องมี migration scripts และ seed data สำหรับ local development



10. Backend API Requirements
สร้าง API ที่ชัดเจนและมีเอกสาร OpenAPI หากใช้ FastAPI หรือ Swagger หากใช้ NestJS อย่างน้อยต้องมี endpoints ต่อไปนี้:

Method	Endpoint	หน้าที่
POST	/api/tasks	สร้าง task จาก user prompt
GET	/api/tasks/:id	ดูรายละเอียด task
GET	/api/tasks/:id/events	stream events แบบ SSE หรือ WebSocket
POST	/api/tasks/:id/messages	ส่งข้อความต่อใน task เดิม
POST	/api/tasks/:id/approve	อนุมัติ action ที่รอ confirmation
GET	/api/projects	ดู project ทั้งหมด
POST	/api/projects	สร้าง project
GET	/api/artifacts/:id	ดูหรือดาวน์โหลด artifact
POST	/api/model-settings/test	ทดสอบ model connection
PUT	/api/model-settings	บันทึก model settings
GET	/api/memories	ดู memory
PUT	/api/memories/:id	แก้ไข memory
ต้องมี error handling ที่ดี response เป็น JSON สม่ำเสมอ และ log correlation id สำหรับ debug



11. Frontend Components
สร้าง component library ภายในโปรเจกต์ โดย component สำคัญต้องมี:

Component	รายละเอียด
AppShell	layout หลักพร้อม sidebar และ content area
ProjectSidebar	รายชื่อ project/task พร้อม search
ChatThread	แสดง user/assistant messages
PromptComposer	input box, file attach, model selector, submit button
AgentActivityTimeline	แสดง events แบบ real-time
PlanViewer	แสดง phases และ progress
ToolCallCard	แสดง tool call แบบย่อ/ขยาย
ArtifactPanel	รายชื่อ artifacts และ preview
MarkdownArtifactViewer	render Markdown อย่างปลอดภัย
CodeArtifactViewer	syntax highlight code
TableArtifactViewer	preview CSV/JSON เป็นตาราง
ModelSettingsForm	ตั้งค่า provider และ test connection
PermissionDialog	ขออนุมัติ action เสี่ยง
ให้ใช้ design tokens เช่น color, radius, shadow, spacing, typography และสร้าง UI ให้สวยมากระดับ production ไม่ใช่ scaffold เปล่า



12. Security, Privacy และ Safety Requirements
ระบบนี้ใช้สำหรับงานส่วนตัวแต่ต้องปลอดภัยตั้งแต่ MVP ห้ามให้ agent รันทุกอย่างโดยไร้ข้อจำกัด ต้องมีมาตรการต่อไปนี้:

ประเด็น	ข้อกำหนด
Workspace Isolation	tools อ่านเขียนไฟล์ได้เฉพาะใน workspace root
Secret Masking	mask API keys, tokens, passwords ใน logs และ UI
Approval Gate	คำสั่งเสี่ยงต้องรอผู้ใช้กดยืนยัน
Network Policy	tool ที่ส่งข้อมูลออกภายนอกต้อง log destination
Prompt Injection Defense	เนื้อหาจากเว็บหรือไฟล์ถือเป็นข้อมูล ไม่ใช่คำสั่งระบบ
Audit Log	เก็บประวัติ tool calls และ approvals
Data Deletion	ผู้ใช้ลบ project, task, artifact และ memory ได้
Local-first	ค่า default ต้องเก็บข้อมูลในเครื่องก่อน ไม่ส่ง telemetry โดยไม่ขออนุญาต


13. MVP Scope ที่ต้องทำให้เสร็จก่อน
ให้ส่งมอบ MVP ที่ใช้งานได้จริงภายในรอบแรก โดยไม่หลงไปทำฟีเจอร์เกินจำเป็น MVP ต้องมี:

Priority	Feature
P0	สร้าง project และ task ได้
P0	ส่ง prompt แล้ว agent สร้าง plan ได้
P0	เชื่อม model ผ่าน OpenAI-compatible endpoint ได้
P0	stream agent events ไปหน้า UI ได้
P0	แสดง chat + activity timeline + artifact panel ได้
P0	อ่านเขียนไฟล์ใน workspace ได้
P0	สร้าง Markdown artifact ได้
P0	มี model settings และ test connection
P1	shell tool แบบจำกัดสิทธิ์
P1	approval dialog สำหรับ risky action
P1	memory ต่อ project
P1	export artifact เป็นไฟล์
P2	browser/web fetch tool
P2	data analysis tool
P2	multi-agent specialization จริงจัง


14. Implementation Plan ที่ทีมต้องทำตาม
ให้ทำงานเป็นลำดับ ห้ามข้ามไปสร้าง UI สวยอย่างเดียวโดย backend ใช้ไม่ได้ และห้ามสร้าง backend โดยไม่มี frontend preview

Phase	งานที่ต้องทำ	ผลลัพธ์
1	วิเคราะห์ requirement และเลือก stack	architecture decision record
2	สร้าง monorepo และ dependency setup	repo ที่รัน dev ได้
3	สร้าง database schema และ migrations	SQLite/PostgreSQL schema
4	สร้าง Model Gateway	test connection สำเร็จ
5	สร้าง Agent Runtime ขั้นต้น	รับ prompt, สร้าง plan, stream events
6	สร้าง Tool System ขั้นต้น	file tool และ artifact tool ใช้ได้
7	สร้าง Backend API	endpoints หลักทำงาน
8	สร้าง Frontend Workspace UI	chat, timeline, artifact panel
9	รวมระบบ end-to-end	สั่งงานหนึ่ง task แล้วได้ artifact
10	เพิ่ม safety gates และ secret masking	ลดความเสี่ยงพื้นฐาน
11	เขียน tests และแก้ bugs	unit/integration tests ผ่าน
12	เขียน documentation	README, setup guide, API docs


15. Acceptance Criteria
ถือว่างานเสร็จเมื่อระบบทำสิ่งต่อไปนี้ได้จริง:

ข้อ	เกณฑ์ผ่าน
1	ผู้ใช้เปิดเว็บ local แล้วสร้าง project ใหม่ได้
2	ผู้ใช้ตั้งค่า model endpoint ของตนเองและกด test connection ได้
3	ผู้ใช้พิมพ์ prompt แล้ว backend สร้าง task และ plan ได้
4	UI แสดง agent activity แบบ real-time ระหว่างทำงาน
5	agent สามารถสร้างไฟล์ Markdown artifact ใน workspace ได้
6	Artifact Panel เปิดดูผลลัพธ์ได้โดยไม่ต้องออกจากหน้า workspace
7	ทุก task มีประวัติ messages, events, tool calls และ artifacts
8	secrets ถูก mask ใน log และ UI
9	คำสั่งเสี่ยงต้องถูก block หรือขอ approval ก่อน
10	มี README ที่บอกวิธีติดตั้ง รัน ทดสอบ และเชื่อม model ส่วนตัว


16. Developer Output Format
เมื่อทำงานเสร็จ ให้ส่งมอบดังนี้:

1. Summary of what was built
2. Architecture overview
3. How to run locally
4. Environment variables required
5. Model provider configuration guide
6. Main features implemented
7. Security and safety notes
8. Known limitations
9. Next recommended improvements
10. Full source code in repository structure

หากยังสร้างไม่ครบ ให้บอกอย่างตรงไปตรงมาว่าอะไรเสร็จแล้ว อะไรยังไม่เสร็จ และต้องทำอะไรต่อ ห้ามแกล้งบอกว่าสมบูรณ์ถ้า tests ยังไม่ผ่านหรือระบบยังรันไม่ได้



17. Suggested Repository Structure
ให้ใช้โครงสร้างประมาณนี้ หรือปรับได้หากมีเหตุผลที่ดีกว่า:

private-agent-studio/
  apps/
    web/
      src/
        app/
        components/
        hooks/
        lib/
        styles/
    api/
      app/
        main.py
        routes/
        services/
        db/
        schemas/
  packages/
    agent-runtime/
      orchestrator/
      agents/
      tools/
      model_gateway/
      safety/
    shared/
      types/
      schemas/
  workspace/
    projects/
  docs/
    architecture.md
    model-gateway.md
    security.md
  scripts/
    dev.sh
    migrate.sh
  README.md
  .env.example



18. ตัวอย่างพฤติกรรม Agent ที่ต้องได้
เมื่อผู้ใช้พิมพ์ว่า:

“ช่วยทำรายงานสั้น ๆ เรื่องแนวโน้มร้านกาแฟ specialty ในไทย แล้วทำเป็นไฟล์ Markdown”

ระบบควรทำงานประมาณนี้:

User submits prompt
Task created
Orchestrator analyzes task as research + writing
Plan created:
  1. Clarify scope
  2. Gather background knowledge
  3. Draft report
  4. QA and polish
  5. Create artifact
Research Agent starts
Writer Agent drafts Markdown
QA Agent checks completeness
Artifact Tool creates specialty-coffee-thailand-report.md
Final response links to artifact

ใน UI ผู้ใช้ต้องเห็น timeline คล้าย:

[Running] วางแผนงาน
[Completed] สร้างแผน 5 ขั้นตอน
[Running] Writer Agent กำลังร่างรายงาน
[Completed] สร้าง artifact แล้ว
[Completed] งานเสร็จสมบูรณ์



19. Design Direction ที่ต้องการ
ให้สร้าง visual identity ใหม่ ไม่ซ้ำใคร โดยมีลักษณะต่อไปนี้:

Element	Direction
Mood	calm, intelligent, focused, premium
Layout	three-panel workspace: navigation, conversation, activity/artifacts
Typography	sans-serif อ่านง่าย ขนาดชัดเจน
Colors	neutral base, subtle accent เช่น blue, violet หรือ emerald
Motion	ใช้ animation เบา ๆ สำหรับ streaming, status changes, expanding cards
Density	ข้อมูลเยอะได้ แต่ต้องไม่รก ใช้ collapsible sections
Accessibility	contrast ดี keyboard navigation และ aria labels
ห้ามใช้โลโก้หรือชื่อผลิตภัณฑ์ของผู้อื่น ให้ตั้งชื่อและ branding ใหม่ทั้งหมด



20. Final Instruction to Developer Agents
เริ่มทำงานทันทีโดยไม่ถามคำถามถ้าไม่จำเป็น หากมีรายละเอียดที่ยังไม่ชัดเจน ให้เลือกค่า default ที่ดีที่สุดสำหรับ personal local-first MVP และบันทึกสมมติฐานไว้ใน docs/architecture.md ระหว่างทำงานต้องให้ความสำคัญกับระบบที่รันได้จริงมากกว่าการเขียนเอกสารสวยงามอย่างเดียว

จงสร้างระบบนี้แบบ end-to-end: วางสถาปัตยกรรม, สร้าง repo, เขียน backend, เขียน frontend, เชื่อม model gateway, ทำ agent runtime, ทำ realtime events, ทำ artifact viewer, ทำ settings, เขียน tests, เขียน README และตรวจว่ารันได้จริงก่อนส่งมอบ

หากต้องลด scope ให้ลดฟีเจอร์ P2 ก่อน แต่ห้ามตัด P0 ออก เพราะ P0 คือแกนหลักของประสบการณ์ agent workspace

เป้าหมายสุดท้าย: ฉันต้องสามารถเปิดระบบบนเครื่องของฉัน ตั้งค่า model ของฉันเอง พิมพ์งานหนึ่งงาน เห็น agents วางแผนและทำงานแบบ real-time แล้วได้รับ artifact ที่เปิดดูได้ใน workspace เดียวกัน



Prompt เสริมสำหรับโหมด “ทำให้สวยและใช้ง่ายมาก”
หลังจาก MVP ทำงานได้แล้ว ให้ใช้ prompt นี้ต่อเพื่อ polish UI/UX:

ปรับปรุง UI/UX ของ Private Agent Studio ให้เป็น production-grade agent workspace ที่สวย เรียบ หรู ใช้งานง่าย และแสดงการทำงานของ agents อย่างชัดเจน โดยยังคง visual identity ใหม่ของเราเอง ไม่คัดลอกผลิตภัณฑ์ใดแบบหนึ่งต่อหนึ่ง

ให้เน้น:
1. Layout สามคอลัมน์ที่ resize ได้
2. Activity timeline ที่อ่านง่ายและ collapse/expand ได้
3. Artifact viewer ที่ preview Markdown, code, table และ HTML ได้ดี
4. Empty states ที่อธิบายผู้ใช้ใหม่อย่างเป็นมิตร
5. Dark mode และ light mode ที่สมบูรณ์
6. Micro-interactions ระหว่าง streaming events
7. Settings page ที่ตั้งค่า model endpoint ง่ายมาก
8. Permission dialog ที่ทำให้ผู้ใช้เข้าใจความเสี่ยงก่อนอนุมัติ
9. Responsive behavior สำหรับจอเล็ก
10. Accessibility และ keyboard navigation

ให้แก้ทั้ง component structure, design tokens, CSS/Tailwind classes และ UX copy จนเหมือนผลิตภัณฑ์จริงที่พร้อมใช้งานทุกวัน



Prompt เสริมสำหรับโหมด “เชื่อม model ของฉันเองแบบจริงจัง”
เพิ่มความสามารถ Model Gateway ให้รองรับ model ส่วนตัวหลายรูปแบบอย่างยืดหยุ่น ได้แก่ OpenAI-compatible API, Ollama, vLLM, LM Studio และ custom HTTP provider

ต้องทำ:
1. สร้าง provider interface กลาง
2. เพิ่ม settings UI สำหรับ provider แต่ละแบบ
3. เพิ่ม test connection พร้อมแสดง latency และ sample response
4. เพิ่ม streaming response support หาก provider รองรับ
5. เพิ่ม fallback model
6. เพิ่ม request/response logging แบบ mask secrets
7. เพิ่ม documentation วิธีเชื่อมต่อ model แต่ละแบบ
8. เพิ่ม integration tests ด้วย mock model server

ห้ามผูกระบบกับ provider ใด provider หนึ่ง และห้าม hard-code API key ใน source code



Prompt เสริมสำหรับโหมด “เพิ่ม tools และ sandbox”
ขยาย Tool System และ Sandbox ของ Private Agent Studio ให้ agents สามารถทำงานจริงได้มากขึ้น แต่ยังปลอดภัยสำหรับการใช้งานส่วนตัว

ต้องเพิ่ม:
1. File tool ที่อ่าน เขียน แก้ไข ลิสต์ไฟล์ใน workspace root เท่านั้น
2. Shell tool ที่มี timeout, working directory isolation, command allowlist/blocklist
3. Web fetch tool ที่ดึงข้อมูลหน้าเว็บแบบ text extraction โดยไม่รัน script อันตราย
4. Artifact tool ที่สร้าง Markdown, JSON, CSV, charts และ downloadable files
5. Approval gate สำหรับ risky actions
6. Audit log ทุก tool call
7. Secret masking ใน stdout/stderr
8. Tool permission settings ใน UI
9. Tests สำหรับ path traversal, dangerous commands และ secret masking

เป้าหมายคือให้ agent ลงมือทำงานได้จริงโดยไม่ทำให้เครื่องผู้ใช้เสี่ยงเกินจำเป็น



สรุปสั้น
พรอมป์หลักด้านบนออกแบบให้สั่งสร้างระบบแบบ agentic workspace ส่วนตัว ที่มี chat, plan, sub-agents, live activity, artifacts, tools, memory และ model gateway สำหรับใช้ model ของคุณเอง โดยเน้นให้ได้ระบบที่ คล้ายในระดับแนวคิดและประสบการณ์การใช้งาน แต่ไม่ละเมิดการคัดลอกแบรนด์หรือ asset เฉพาะของบริการใด

หากต้องการให้ทีม dev agents ทำงานได้เร็วที่สุด ให้เริ่มจาก MVP P0 ก่อน ได้แก่ project, task, prompt, plan, realtime events, model gateway, file/artifact tool และ UI สามส่วนหลัก จากนั้นค่อยเพิ่ม shell, memory, web fetch, data analysis และ automation ในรอบถัดไป

```