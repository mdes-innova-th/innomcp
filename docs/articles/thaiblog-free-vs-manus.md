# Thai Blog Post — INNOMCP

**Target audiences**:
- MDES-Innova blog (Thai tech audience)
- Pantip (Thai forum, tech board)
- Thai RAG Discord
- Facebook groups: Thai Developers, Thai AI Community

---

## ทำไมถึงสร้าง Manus ฟรี + open source ขึ้นมาเอง

*โดยทีม MDES-Innova · กรุงเทพฯ · 7 มิถุนายน 2026 · อ่าน 8 นาที*

---

ช่วงนี้ Manus.im กำลังฮิตมากในวงการ AI — live activity panel, multi-agent, artifact system ทำให้การ chat กับ AI รู้สึก "มีชีวิตชีวา" จริงๆ ผมใช้ Manus มา 6 เดือน ชอบมาก แต่มี 3 อย่างที่ขัดใจ:

1. **$39/เดือน** — แพงไปสำหรับ dev ที่ลองของ
2. **Closed source** — audit ไม่ได้ว่าข้อมูลเราไปไหนบ้าง
3. **English-first** — query ภาษาไทยหลายครั้งได้คำตอบที่แปลกๆ

ผมเลยตัดสินใจสร้างทางเลือกที่ "ฟรี + open source + self-host ได้ + Thai-first" ขึ้นมาใช้เอง

**ชื่อ [INNOMCP](https://github.com/mdes-innova-th/innomcp)** — MIT license — 4 เดือนของการทำงานกลางคืน + วันหยุด — 214 tests ผ่านหมด

วันนี้ปล่อยให้ทุกคนใช้ฟรี บทความนี้เล่าเรื่อง "ทำไม" + "อะไร" + "เรียนรู้อะไรบ้าง"

## ปัญหาของ Manus (และ AI workspace ส่วนใหญ่)

- **$39/เดือน** สำหรับ Pro — ใช้บ่อยก็จ่ายได้ แต่ dev ทั่วไปไม่ไหว
- **Closed source** — ข้อมูลเราไปอยู่บน server เขา ไม่มีทางรู้ว่าเอาไป train ต่อไหม
- **Single provider** — lock-in กับ backend ของ Manus
- **English-first** — Thai query บ่อยครั้งได้คำตอบที่เพี้ยน (โดยเฉพาะชื่อเฉพาะ + สำเนียง)
- **No self-host** — chat history อยู่บน database ของ Manus ตลอดไป

สำหรับ dev สตูดิโอเล็กๆ ในไทยที่ใช้ LLM หลายตัวตามงาน — นี่คือ deal-breaker

## สิ่งที่ผมอยากได้

Workspace ที่:

1. **รู้สึกเหมือน Manus** — live activity, multi-agent, artifacts
2. **รันบนเครื่องเราเอง** — full self-host, no telemetry
3. **เล่นกับทุก LLM ได้** — Claude for reasoning, Haiku for speed, Ollama for offline, MDES for Thai
4. **Thai เป็น first-class** — ไม่ใช่แค่ translation layer แต่เป็น dedicated tools (TMD weather, Thai geo, NWP forecast)
5. **Tool ecosystem จริงๆ** — Model Context Protocol เพิ่ม tool ใหม่ใน 5 นาที
6. **ฟรีจริง** — MIT ไม่ใช่ "free tier with rate limits"

หาไม่เจอ → เลยสร้างเอง

## Architecture (4 เดือน)

```
┌─────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│   Next.js 15    │   │  Node 20 +       │   │  MCP Server      │
│   Chat UI       │←→│  Express 5       │←→│  20+ tools       │
│   Artifacts     │   │  Conductor       │   │  shell, weather  │
│   Activity Log  │   │  Critique Layer  │   │  geo, web fetch  │
└─────────────────┘   └──────────────────┘   └──────────────────┘
                              ↓
                    ┌──────────────────┐
                    │   MariaDB 11     │
                    └──────────────────┘
```

### Multi-agent loop (ส่วนที่น่าสนใจที่สุด)

เมื่อถาม INNOMCP:

1. **Conductor** จำแนก query ("weather + Thai + 7 วัน" → 3 agents)
2. **Parallel dispatch** — 3 agents ยิงพร้อมกัน แต่ละตัวมี tools ของตัวเอง
3. **Critique layer** อ่าน 3 outputs, เลือกที่แข็งแกร่งสุด หรือ re-run ด้วย agents อื่น
4. **Streamed response** + **artifact panel** + **live activity log** — user เห็นหมด

นี่คือสิ่งที่ทำให้ Manus รู้สึก "มีชีวิต" — และสร้างยากกว่าที่คิดมาก demo "agent" ส่วนใหญ่เป็น sequential ไม่ใช่ parallel และไม่มี critique layer

### 10+ providers

```
Claude Sonnet 4.6   — reasoning หนัก, context ยาว
Claude Haiku 4.5    — เร็ว, ถูก, Thai พอใช้
OpenAI GPT-4o-mini  — fallback chain
GitHub Copilot      — code generation
Local Ollama        — 100% private, offline
MDES Ollama         — Thai-optimized
+ 4 more (OpenAI-compatible)
```

Conductor ไม่สนใจว่าคุยกับ provider ไหน route task ต่างกันได้ อยากให้ Haiku จำแนก + Sonnet ตอบสุดท้าย? คลิกเดียว

## Open source (MIT) — และไม่ใช่ open source

Repo ทั้งหมด MIT คุณสามารถ:
- ใช้งานส่วนตัวหรือ commercial
- Fork แล้วแก้
- ขาย hosted version (เชิญเลย)
- ใช้ใน closed-source product

คุณไม่สามารถ:
- ฟ้องเราถ้ามันพัง
- คาดหวัง paid support (มี Discord community + GitHub Discussions)

## 5 บทเรียนจากการสร้าง

### 1. Multi-agent critique คือ magic ingredient
ถ้าเอา critique layer ออก → multi-agent answers ได้ 60-70% ของ single Claude call
ใส่ critique layer เข้าไป → ใกล้ 85% — และ wall-clock เร็วกว่า 3 เท่า

### 2. MCP เป็น abstraction ที่ถูกต้อง
เกือบสร้าง proprietary tool API ไปแล้ว ดีใจที่ไม่ทำ
MCP ให้: schema-validated tools, sandboxing, ecosystem 100+ servers, visual inspector

### 3. Self-hosting คือ feature ไม่ใช่ sacrifice
ทุก dev ที่ demo ถามเหมือนกัน "รันบน server ตัวเองได้ไหม" → "ข้อมูลไม่ออกจากเครื่อง" เป็น one-liner ที่ปิดดีลได้

### 4. Thai-first ≠ Thai-only
เพิ่ม 4 dedicated Thai tools (TMD, Thai geo, NWP, knowledge corpus) → ระบบดีขึ้นสำหรับทุกคน ไม่ใช่แค่คนไทย

### 5. Activity panel = 50% ของ value
ถ้าเอา live activity log ออก → รู้สึก "ฉลาด" น้อยลง 50%
แม้คำตอบผิด การเห็น conductor dispatch + critique ให้ user มั่นใจว่าระบบ *กำลังคิด* นี่คือสิ่งที่ Manus ทำได้ดี

## ลองเลย

```bash
git clone https://github.com/mdes-innova-th/innomcp
cd innomcp
pnpm install
docker compose up -d mariadb
pnpm dev
# http://localhost:3000
```

ไม่มี account, ไม่มี telemetry, ไม่มี rate limits
ใช้ API key ของคุณเอง หรือ local Ollama ฟรี 100%

## ต่อไป

- **Multi-user workspaces** — ทีมที่แชร์ projects + memories
- **Voice input** — Whisper integration (prototype แล้ว)
- **Mobile app** — React Native
- **MCP tools เพิ่ม** — calendar, GitHub, Notion, Slack, ...

## มาร่วมด้วยช่วยกัน

- ⭐ Star the repo — บอก dev คนอื่นว่ามันคุ้มเวลา
- 🐛 File issues — "งง ตรงนี้" ก็มีประโยชน์
- 🛠️ PRs welcome — ดู `CONTRIBUTING.md`
- 💬 Discord (link ใน README) — Q&A + show-and-tell

---

*ถ้าบทความนี้มีประโยชน์ แชร์ให้เพื่อน dev ที่บ่นเรื่อง Manus แพงสักคน เขาจะขอบคุณ*
