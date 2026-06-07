# Phase 9 Handoff — AI Chat World-Class Frontend UX/UI

Date: 2026-05-17
Author: SA
Status: Ready for implementation handoff

## Objective

ยกระดับ chat experience ฝั่ง frontend ให้ดูนิ่ง คม และชัดสำหรับผู้ใช้จริง โดยลด cognitive noise ของระบบ agent/tool แต่คงความสามารถเดิมไว้ทั้งหมด

งานนี้ต้อง preserve พฤติกรรมหลักเดิม:

- Thai-first chat flow
- multi-tool / multi-agent execution
- attachment workflow
- starter prompts
- responsive sidebar/history

แต่ต้องจัด hierarchy ใหม่ให้ผู้ใช้เห็นแค่ว่า "ถามได้เลย ระบบกำลังทำงาน และคำตอบมาจากอะไร" โดยไม่ต้องแบกศัพท์เทคนิคของ pipeline

## Current Verified Surface

### Primary components

- `innomcp-next/src/app/components/chat/ChatPage.tsx`
  - คุมทั้ง empty state, conversation state, sidebar layout, message thread, inline MultiAgent panel
  - มี `STARTER_PROMPTS`, `WORKSPACE_PILLARS`, `workspaceState`, sticky working indicator, SSE agent stream wiring
- `innomcp-next/src/app/components/chat/ChatInput.tsx`
  - คุม composer, attachment strip, audio hint, mode selector, tool selector, connection status, send/stop actions
- `innomcp-next/src/app/components/chat/ChatSidebar.tsx`
  - มี collapsed/expanded modes, history search, new chat action, user/settings affordances
- `innomcp-next/src/app/components/chat/ChatMessage.tsx`
  - คุม rich message rendering หลายชนิด เช่น evidence, weather payload, generated image, QR, APOD

### Important context

- Existing `docs/4Opus/chat-page-reqs.md` ยังใช้ได้ในเชิง direction แต่บาง file targets เริ่ม stale แล้ว เช่น `AIModelSelector.tsx` ไม่ใช่ anchor หลักอีกต่อไป เพราะ composer ปัจจุบันใช้ `ChatModeSelector`
- Existing chat sidebar collapsed mode มี history badge อยู่แล้ว ดังนั้นงานต่อจากนี้ไม่ใช่ "เพิ่ม badge" แต่เป็น "ทำให้ collapsed state สื่อความหมายทั้งระบบมากขึ้นโดยไม่รก"

## High-Impact UX Findings

### 1. Empty state แข็งแรง แต่หายไปเร็วเกินไป

`ChatPage.tsx` แยก empty state กับ conversation state แบบคนละโลก เมื่อมีข้อความแรก `STARTER_PROMPTS` และ onboarding context จะหายทันที

ผลกระทบ:

- ผู้ใช้ที่ยัง explore งานหลายแบบใน session เดียวเสีย discovery surface ทันที
- first-turn experience ดี แต่ second-turn onboarding หาย

### 2. Composer ยังแบกการตัดสินใจมากเกินจำเป็น

`ChatInput.tsx` รวม textarea, attachment, tool selector, chat mode selector, connection state, char counter, and send/stop controls ไว้ในจุดเดียว

ผลกระทบ:

- ผู้ใช้ใหม่ต้อง parse control เยอะก่อนส่งข้อความแรก
- visual emphasis ของ "พิมพ์แล้วส่ง" ไม่เด่นที่สุดเสมอ

### 3. System status กระจายหลายจุด

ตอนนี้ feedback มาจากหลายชั้นพร้อมกัน:

- `workspaceState` ใน page header
- connection/processing dot ใน composer
- sticky working indicator
- inline `MultiAgentPanel`

ผลกระทบ:

- ผู้ใช้เห็นว่า system กำลังทำงาน แต่ไม่รู้ว่าอันไหนคือ source of truth
- technical feedback ดีสำหรับ power users แต่หนาเกินไปสำหรับ default user path

### 4. Inline MultiAgent panel ยังกลืน focus ของคำตอบหลัก

`ChatPage.tsx` inject `MultiAgentPanel` ไว้ใน thread ใกล้ AI message และแสดงได้แม้ผู้ใช้ยังไม่ได้อ่าน final answer

ผลกระทบ:

- พื้นที่ที่ควรเป็น “answer-first” กลายเป็น “pipeline-first”
- ทำให้คำตอบดูซับซ้อน แม้ result จะอ่านง่ายแล้วก็ตาม

### 5. Empty/conversation hierarchy ยังไม่ใช้ shared design language เดียวกัน

empty state ใช้ hero + cards + right rail ที่ดู polished มาก แต่ conversation state เปลี่ยนเป็น thread + status chips ที่ utilitarian กว่า

ผลกระทบ:

- transition จาก pre-send ไป post-send รู้สึกเหมือนข้าม product mode
- brand impression ไม่ต่อเนื่อง

## Design Direction

## 1. Empty State

เป้าหมาย:

- ให้หน้าแรกเป็น discovery workspace ไม่ใช่ splash screen ชั่วคราว

แนวทาง:

- แยก `StarterPromptsGrid` ออกเป็น component ชัดเจน
- ให้ grid ยังคงอยู่แบบ reduced mode หลังมีข้อความแรก 1-3 turns
- right rail เปลี่ยนจาก static tips เป็น "How to ask better" card ที่กดเอา prompt ไปใส่ composer ได้
- ลดคำอธิบาย hero ให้สั้นกว่าเดิม แล้วย้ายส่วน capability brag ไปเป็น compact trust bar

ผลลัพธ์ที่ต้องได้:

- ผู้ใช้เริ่มจากตัวอย่าง และยังกลับมาหยิบตัวอย่างเพิ่มได้โดยไม่ต้อง new chat ทุกครั้ง

## 2. Conversation State

เป้าหมาย:

- answer-first, tools-second, pipeline-third

แนวทาง:

- สร้าง `StatusRibbon` เดียวด้านบนสำหรับ `ready`, `thinking`, `offline`, `error`
- ให้ `MultiAgentPanel` อยู่ใน collapsible disclosure โดย default collapsed
- ให้ message thread รักษาภาษาของ empty state เช่น card radii, headline weight, muted surfaces, spacing rhythm
- ให้ tool provenance อยู่ใน message bubble เป็น compact labels ไม่กระจายไปที่ header และ panel พร้อมกัน

ผลลัพธ์ที่ต้องได้:

- คนทั่วไปเห็นแค่สถานะที่จำเป็น
- power user ยังเปิดดู agent timeline ได้เมื่ออยาก inspect

## 3. Composer and Action Model

เป้าหมาย:

- ลด pre-send friction ให้ใกล้ chat products ชั้นนำ แต่ไม่ลด capability

แนวทาง:

- ย้าย `ChatModeSelector` และ `ToolsTypeSelector` ออกจาก inline composer ไปอยู่ settings sheet / sidebar preferences
- composer เหลือ 3 primitives หลัก: input, attach, send/stop
- connection state ไม่ควรอยู่ใน composer ถ้ามี `StatusRibbon` แล้ว
- char counter แสดงเฉพาะช่วงเข้าใกล้ soft limit
- เพิ่ม helper microcopy แบบเบา เช่น `Enter ส่ง · Shift+Enter ขึ้นบรรทัดใหม่`

ผลลัพธ์ที่ต้องได้:

- first action ชัดขึ้นทันที
- advanced controls ยังอยู่ แต่ไม่บด primary path

## Implementation Sequence

1. Extract empty-state sections in `ChatPage.tsx`
   - สร้าง `StarterPromptsGrid` และ `ChatWelcomeRail`
   - ทำ reduced mode หลังเริ่มบทสนทนาแล้ว แต่ยังไม่ hide ทันที

2. Create single status system
   - สร้าง `StatusRibbon` ที่ใช้ state จาก `isSocketReady`, `isWaitingForResponse`, และ stream status
   - ลดหรือถอด status duplication จาก page header/composer

3. Simplify composer
   - ย้าย mode/tool selectors ออกจาก `ChatInput.tsx`
   - เหลือ send flow ที่ชัดที่สุด

4. Reframe agent visibility
   - ทำ `MultiAgentPanel` เป็น disclosure/drawer ที่ collapsed by default
   - header summary ใช้ภาษาคน เช่น `AI กำลังวิเคราะห์ 3 ส่วน`

5. Harmonize thread styling
   - ใช้ spacing, borders, chip language ให้ conversation state สอดคล้องกับ empty-state visual system
   - ตรวจ ChatMessage cards ที่หนักเกินไปไม่ให้แข่งกันเองเมื่อหลาย content types ปรากฏพร้อมกัน

6. Validate responsive and accessibility quality
   - viewport 360, 768, 1280, 1440
   - keyboard focus path
   - reduced-motion safe
   - Thai readability and contrast

## Files to Touch

- `innomcp-next/src/app/components/chat/ChatPage.tsx`
  - เจ้าของ layout, empty/conversation branching, status placement, agent panel injection
- `innomcp-next/src/app/components/chat/ChatInput.tsx`
  - เจ้าของ composer complexity และ pre-send friction
- `innomcp-next/src/app/components/chat/ChatSidebar.tsx`
  - เจ้าของ sidebar preferences entry point และ collapsed mental model
- `innomcp-next/src/app/components/chat/ChatMessage.tsx`
  - เจ้าของ visual rhythm ของ rich tool outputs
- `innomcp-next/src/app/components/chat/MultiAgentPanel.tsx`
  - เจ้าของ technical disclosure layer
- `innomcp-next/src/app/styles/globals.css`
  - เจ้าของ shared chat tokens / motion / panel feel

## Acceptance Criteria

- Empty state ยังช่วย discovery ได้แม้เริ่มคุยไปแล้วเล็กน้อย
- Composer แสดง primary action เด่นสุดโดยไม่ต้องอธิบายเยอะ
- User เห็น status หลักเพียงหนึ่งระบบต่อเวลา
- Agent/tool internals ไม่แย่ง attention จาก final answer โดย default
- Empty state และ conversation state รู้สึกเป็น product ภาษาเดียวกัน
- Mobile and desktop ไม่เกิด panel crowding หรือ input compression

## Notes for Executor

- Preserve established product language and current working features; ห้าม redesign แบบทุบของเดิมแล้วเริ่มใหม่
- Avoid introducing new jargon on the surface UI
- Prefer additive extraction over giant rewrite inside `ChatPage.tsx`
- If implementation scopeเริ่มบาน ให้ทำลำดับ: status unification -> composer simplification -> persistent starter prompts -> agent panel disclosure