# สถาปัตยกรรม Agent Loop (Agent Loop Architecture)

## ภาพรวม (Overview)

ระบบประกอบด้วย 4 ส่วนหลักที่ทำงานร่วมกันเพื่อส่งมอบ streaming แบบ manus-style:

1. **agentLoop.ts** – ตัวจัดการ loop การทำงานของ agent (agent loop manager)
2. **agentStream** – SSE endpoint สำหรับ streaming ผลลัพธ์ (SSE stream endpoint)
3. **useAgentStream** – React hook สำหรับ consume stream จาก client side
4. **AgentStepList** – UI component แสดงลำดับขั้นตอนของ agent แบบ real-time

## ลำดับการทำงาน (Sequence Diagram)

```
Client (React)          Server (agentStream router)    agentLoop.ts    LLM / Conductor
     |                          |                          |                 |
     |-- POST /api/agent/run -->|                          |                 |
     |                          |-- createAgentLoop() ---->|                 |
     |                          |                          |-- step() ------>|
     |                          |                          |<-- partial ----|
     |                          |                          |-- event:step   |
     |                          |<-- SSE: step ------------|                 |
     |<-- useAgentStream(data) -|                          |                 |
     |                          |                          |-- step() ------>|
     |                          |                          |<-- final ------|
     |                          |                          |-- event:done   |
     |                          |<-- SSE: done ------------|                 |
     |<-- AgentStepList update -|                          |                 |
     |                          |                          |                 |
```

## การประกอบกัน (Composition)

### `agentLoop.ts`
- สร้าง `AgentLoop` instance ที่เก็บ state ของ steps, messages, status
- มี method `step()` ซึ่งเรียก LLM หรือ conductor และ emit events ผ่าน `EventEmitter`
- แต่ละ step จะมี `id`, `type`, `status`, `content`

### `agentStream` (SSE Router)
- รับ request `POST /api/agent/run`
- สร้าง `AgentLoop` instance และ subscribe กับ events
- แปลง events เป็น SSE format (`event: step/done/error`)
- ส่ง response ด้วย `Content-Type: text/event-stream`

### `useAgentStream` (React Hook)
- รับ URL params หรือ payload
- เปิด `EventSource` หรือ `fetch` + `ReadableStream`
- parse SSE events และอัปเดต state (`steps`, `currentStep`, `isRunning`)
- คืนค่า `{ steps, currentStep, isRunning, start, cancel }`

### `AgentStepList` (UI Component)
- รับ `steps` array และ `currentStepId`
- แสดงรายการ step แบบเรียงลำดับ
- สนับสนุน animation (spinner สำ��รับ running, checkmark สำหรับ complete, error สำหรับ failed)
- ใช้ `useAgentStream` ภายในเพื่อรับ data

## การ Integrate เข้ากับแอปพลิเคชัน (Integration)

### ใน `app.ts` (หรือ `server.ts`)

```typescript
import { agentStreamRouter } from './features/agent/agentStream';

// ต่อ router เข้ากับ Express/Next.js API route
app.use('/api/agent', agentStreamRouter);
```

### ใน Workspace Panel

```tsx
import { AgentStepList } from './features/agent/AgentStepList';
import { useAgentStream } from './features/agent/useAgentStream';

function WorkspacePanel() {
  const { steps, currentStep, start, cancel, isRunning } = useAgentStream({
    url: '/api/agent/run',
  });

  return (
    <div className="workspace-panel">
      <AgentStepList steps={steps} currentStepId={currentStep?.id} />
      {isRunning && <Spinner />}
      <button onClick={() => start({ prompt })} disabled={isRunning}>
        Run Agent
      </button>
    </div>
  );
}
```

## การอยู่ร่วมกับ Conductor เดิม (Coexistence with Existing Conductor)

- `agentLoop.ts` สามารถเรียก `conductor` (ระบบเดิม) เป็นหนึ่งในขั้นตอน (LLM step)
- โดยใน `step()` จะมี case ที่เช็ค type: ถ้าเป็น `'llm'` จะเรียก `conductor.generate()` แทน
- ทำให้ระบบใหม่ (agent loop) สามารถ reuse logic ของ conductor เดิมได้โดยไม่ต้อง rewrite
- ข้อมูลที่ conductor ส่งกลับมาจะถูก wrap เป็น `AgentStep` object และ stream ต่อผ่าน SSE

```typescript
// ภายใน agentLoop.ts
async step(input: AgentStepInput) {
  if (input.type === 'llm') {
    const result = await conductor.generate(input.messages);
    this.emit('step', { id: nanoid(), type: 'llm', content: result, status: 'complete' });
  } else {
    // logic สำหรับ tool / action steps
  }
}
```

## สรุป (Summary)

- `agentLoop` + `agentStream` = server-side streaming endpoint
- `useAgentStream` + `AgentStepList` = client-side real-time UI
- Conductor เก่าสามารถเป็น backend step หนึ่งใน loop ใหม่ได้
- สถาปัตยกรรมนี้ช่วยให้ผู้ใช้เห็น progress แบบ step-by-step เหมือน manus.ai
