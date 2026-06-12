<!-- cc-team deliverable
 group: P4C (Phase 4.3 â€” Wire AgentStepsView to real dispatch events)
 member: P4C-3 role=doc model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":61,"completion_tokens":2342,"total_tokens":2403,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":69,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 87s
 generated: 2026-06-12T03:45:33.260Z -->
# VERIFY.md — Phase 4.3: AgentStepsView

## ภาพรวม / Overview

| รายการ / Item | รายละเอียด / Details |
|---|---|
| **Phase** | 4.3 — AgentStepsView |
| **ฟีเจอร์ / Feature** | แสดง Agent Steps แบบ real-time ระหว่างการสนทนา / Display Agent Steps in real-time during active chat |
| **ไฟล์หลัก / Key Files** | `AgentStepsView.tsx`, `useAgentSteps.ts`, `ws` provider |

---

## วิธีทดสอบ / How to Test

### ข้อกำหนดเบื้องต้น / Prerequisites

1. เปิดแอปพลิเคชันด้วย `npm run dev` / Start the app with `npm run dev`
2. เปิด Browser DevTools → Console / Open Browser DevTools → Console
3. ตรวจสอบว่า WebSocket เชื่อมต่อแล้ว / Verify WebSocket is connected:

```javascript
// ตรวจสอบ WS connection status / Check WS connection status
console.log(window.__WS_CONNECTED__); // ควรเป็น true / should be true
```

### ส่ง Manual WS Message / Send Manual WS Message

คัดลอกและรันโค้ดด้านล่างใน Browser Console / Copy and run the following code in the Browser Console:

#### Test Case 1: ส่ง Step เดียว / Send a Single Step

```javascript
const ws = window.__WS_INSTANCE__;

ws.send(JSON.stringify({
  type: "agent_step",
  data: {
    id: "step-001",
    title: "🔍 กำลังค้นหาข้อมูล / Searching for information",
    status: "running",
    timestamp: Date.now()
  }
}));
```

#### Test Case 2: ส่งหลาย Steps ต่อเนื่อง / Send Multiple Streaming Steps

```javascript
const ws = window.__WS_INSTANCE__;

const steps = [
  { id: "step-001", title: "🔍 กำลังวิเคราะห์คำถาม / Analyzing query", status: "completed" },
  { id: "step-002", title: "📂 กำลังค้นหาเอกสาร / Searching documents", status: "running" },
  { id: "step-003", title: "🧠 กำลังสรุปผล / Generating summary", status: "pending" }
];

steps.forEach((step, i) => {
  setTimeout(() => {
    ws.send(JSON.stringify({
      type: "agent_step",
      data: { ...step, timestamp: Date.now() }
    }));
  }, i * 1500);
});
```

#### Test Case 3: อัปเดต Status ของ Step / Update Step Status

```javascript
const ws = window.__WS_INSTANCE__;

// อัปเดต step จาก running → completed / Update step from running → completed
ws.send(JSON.stringify({
  type: "agent_step_update",
  data: {
    id: "step-002",
    status: "completed",
    timestamp: Date.now()
  }
}));
```

#### Test Case 4: จำลอง Full Chat Flow / Simulate Full Chat Flow

```javascript
const ws = window.__WS_INSTANCE__;

const flow = [
  { type: "agent_step", data: { id: "s1", title: "🔍 Understanding query", status: "running" } },
  { type: "agent_step_update", data: { id: "s1", status: "completed" } },
  { type: "agent_step", data: { id: "s2", title: "📂 Retrieving documents", status: "running" } },
  { type: "agent_step_update", data: { id: "s2", status: "completed" } },
  { type: "agent_step", data: { id: "s3", title: "✍️ Composing answer", status: "running" } },
  { type: "agent_step_update", data: { id: "s3", status: "completed" } },
  { type: "agent_steps_done", data: {} }
];

flow.forEach((msg, i) => {
  setTimeout(() => {
    ws.send(JSON.stringify({ ...msg, data: { ...msg.data, timestamp: Date.now() } }));
  }, i * 1200);
});
```

#### Test Case 5: ล้าง Steps / Clear Steps

```javascript
const ws = window.__WS_INSTANCE__;

ws.send(JSON.stringify({
  type: "agent_steps_done",
  data: {}
}));
```

---

## พฤติกรรมที่คาดหวัง / Expected UI Behavior

| เหตุการณ์ / Event | พฤติกรรมที่คาดหวัง / Expected Behavior |
|---|---|
| รับ `agent_step` (status: `running`) / Receive `agent_step` (status: `running`) | Step ปรากฏใน UI ทันทีพร้อม animation spinner / Step appears in UI immediately with spinner animation |
| รับ `agent_step` (status: `pending`) / Receive `agent_step` (status: `pending`) | Step ปรากฏใน UI ในสถานะ dimmed/waiting / Step appears in UI in dimmed/waiting state |
| รับ `agent_step_update` (status: `completed`) / Receive `agent_step_update` (status: `completed`) | Step เปลี่ยนเป็นเครื่องหมาย ✓ สีเขียว พร้อม fade-in transition / Step transitions to green ✓ with fade-in transition |
| รับ `agent_step_update` (status: `error`) / Receive `agent_step_update` (status: `error`) | Step เปลี่ยนเป็นเครื่องหมาย ✗ สีแดง / Step transitions to red ✗ |
| รับ `agent_steps_done` / Receive `agent_steps_done` | Steps panel ยุบลงหรือซ่อนหลัง delay / Steps panel collapses or hides after a short delay |
| Steps หลายตัวเข้ามาพร้อมกัน / Multiple steps arrive in sequence | Steps แสดงผลแบบ streaming เรียงลำดับ ไม่มีการข้ามหรือซ้ำ / Steps render in streaming order, no skips or duplicates |

---

## เกณฑ์ผ่าน / Pass Criteria

| # | เกณฑ์ / Criterion | ผลลัพธ์ / Result |
|---|---|---|
| 1 | **Steps ปรากฏระหว่าง active chat** — เมื่อส่ง `agent_step` ผ่าน WS, steps มองเห็นได้ทันทีในหน้าจอ / **Steps visible during active chat** — When `agent_step` is sent via WS, steps are immediately visible on screen | ☐ Pass / ☐ Fail |
| 2 | **Streaming real-time** — steps แสดงทีละขั้นตามลำดับที่ส่งมา ไม่รอจนครบทุกขั้น / **Streaming real-time** — steps appear one by one in order, not batched at the end | ☐ Pass / ☐ Fail |
| 3 | **Status transitions ถูกต้อง** — `pending` → `running` → `completed`/`error` เปลี่ยน icon และสีถูกต้อง / **Status transitions correct** — `pending` → `running` → `completed`/`error` icon and color changes are correct | ☐ Pass / ☐ Fail |
| 4 | **ไม่มี step ซ้ำ** — ส่ง `agent_step` ด้วย `id` เดิมซ้ำ ไม่ควรสร้าง step ใหม่ / **No duplicate steps** — sending `agent_step` with same `id` should update, not create a new step | ☐ Pass / ☐ Fail |
| 5 | **Steps หายไปหลัง chat จบ** — เมื่อได้รับ `agent_steps_done`, steps panel ซ่อนหรือยุบ / **Steps disappear after chat ends** — on `agent_steps_done`, steps panel hides or collapses | ☐ Pass / ☐ Fail |
| 6 | **ไม่มี console error** — ไม่มี error ใน browser console ระหว่างทดสอบ / **No console errors** — no errors in browser console during testing | ☐ Pass / ☐ Fail |

---

## หมายเหตุ / Notes

- หาก `window.__WS_INSTANCE__` ไม่พร้อมใช้งาน ให้ตรวจสอบว่า WS provider มีการ expose instance ไว้บน window object / If `window.__WS_INSTANCE__` is unavailable, verify the WS provider exposes the instance on the window object
- สำหรับกรณีที่ไม่มี WS connection จริง สาม���รถทดสอบผ่าน mock function ใน component ได้ / For cases without a real WS connection, testing can be done via mock functions in the component
- ทดสอบบน Chrome และ Firefox เพื่อยืนยัน cross-browser compatibility / Test on both Chrome and Firefox to confirm cross-browser compatibility
