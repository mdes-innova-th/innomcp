# Phase 6 Plan — Language Routing and Response Composition
**Date:** 2026-04-29
**Author:** SA
**Status:** Draft architecture plan for handoff to Opus 4.7

---

## Executive Position

แนวคิด "มี agent 2 ตัว" **ดี** แต่ควรทำเป็น **specialist services ที่ถูกเรียกตามเงื่อนไข** ไม่ใช่ workers ที่รันทุก query

ถ้าทำแบบ always-on:
- ทุกข้อความต้องผ่าน translator/analyst ก่อน routing
- latency จะเพิ่มแบบคงที่
- image query ดีขึ้นจริง แต่ general chat จะช้าลงโดยไม่จำเป็น

ดังนั้น architecture ที่เหมาะกับ `innomcp` คือ:

1. `PromptAdapterAgent`
   - ทำหน้าที่ language adaptation / query normalization
   - ถูกเรียกเฉพาะ image generation และ planner ambiguity

2. `ResponseComposerAgent`
   - ทำหน้าที่หลอม outputs จาก tools/APIs ให้เป็น final Thai answer เดียว
   - ถูกเรียกเฉพาะ multi-tool / noisy raw payload paths

---

## Current Verified State

### What the system already has

- `innomcp-node/src/routes/api/chat.ts`
  - deterministic image gate อยู่แล้วทั้ง WS/HTTP
  - `AnswerPlanner` ใช้ intent matching ระดับหยาบ
  - route บางตัวมี tool+rewrite หรือ route-specific synthesis อยู่แล้ว

- `innomcp-node/src/services/imageGenService.ts`
  - `cleanPrompt()` แค่ strip prefix เช่น `สร้างรูป`, `วาดภาพ`, `generate image`
  - provider layer พร้อมใช้งานทั้ง MDES gateway และ Pollinations fallback

- `innomcp-node/src/utils/thaiQueryNormalizer.ts`
  - มี deterministic Thai normalization อยู่แล้ว
  - เหมาะกับการ reuse ใน prompt normalization และ planner normalization

### What is missing

- ไม่มี Thai → English visual prompt adapter
- ไม่มี planner normalization stage ที่แยกจาก route logic
- ไม่มี shared response composer service
- synthesis/rewrite logic กระจายหลายจุดใน `chat.ts`

---

## Problem Breakdown

### Problem A — Thai image prompts underperform

Thai user queries เช่น:
- `สร้างรูปแมวสีแดงสไตล์การ์ตูน`
- `วาดภาพนักบินอวกาศยืนกลางทุ่งนาไทยตอนพระอาทิตย์ตก`

ตอนนี้ถูกส่งต่อเป็น prompt ที่แทบไม่ได้แปลง semantic ให้เหมาะกับ image model

ผลคือ:
- อังกฤษคุณภาพดีกว่าไทย
- ผู้ใช้ต้องเดาเองว่าควรใช้ภาษาอะไร
- ระบบไทยดู "โง่" ใน use case สำคัญมาก

### Problem B — response synthesis ไม่เป็นระบบกลาง

หลาย route มี logic สรุปผลของตัวเองอยู่แล้ว แต่ยังไม่มีชั้นกลางที่รับ compact facts แล้ว compose final Thai answer อย่างสม่ำเสมอ

ผลคือ:
- คุณภาพคำตอบไม่สม่ำเสมอ
- แก้จุดหนึ่งแล้วไม่ได้ยกระดับทั้งระบบ
- เสี่ยง route-by-route hacks เพิ่มขึ้น

---

## Proposed Architecture

## 1. PromptAdapterAgent

### Responsibility

- normalize noisy Thai query
- adapt Thai image prompt → English visual prompt
- produce planner-friendly normalized query

### Output contract

```ts
type AdapterMode = "deterministic" | "llm-fallback" | "passthrough";

interface AdaptedImagePromptResult {
  originalPrompt: string;
  normalizedPromptTh: string;
  adaptedPromptEn: string;
  mode: AdapterMode;
  confidence: number;
  reasons: string[];
}

interface PlannerQueryResult {
  originalQuery: string;
  normalizedQuery: string;
  mode: AdapterMode;
  confidence: number;
  reasons: string[];
}
```

### Execution policy

- Do not run for every query
- Run when:
  - image generation gate matched
  - planner ambiguity detected
  - query is mixed Thai/English/noisy and tool selection confidence is low

### Internal stages

#### Stage 1 — deterministic normalization

- reuse `thaiQueryNormalizer.ts`
- strip image command prefix
- segment style terms / scene terms / objects / colors / camera cues
- preserve proper nouns and location names

#### Stage 2 — deterministic bilingual mapping

Build a small glossary for:
- objects: แมว → cat, เด็กผู้หญิง → girl, นักบินอวกาศ → astronaut
- colors: สีแดง → red, สีทอง → gold
- styles: สไตล์การ์ตูน → cartoon style, สีน้ำ → watercolor, มินิมอล → minimalist
- composition: มุมกว้าง → wide shot, ภาพระยะใกล้ → close-up
- lighting/time: ตอนพระอาทิตย์ตก → at sunset, กลางคืน → at night

#### Stage 3 — optional LLM fallback

Use only when:
- deterministic adaptation confidence below threshold
- prompt is image-related
- prompt is rich enough that semantic loss would hurt output

Guardrails:
- timeout <= 700ms
- one-shot JSON only
- no second-pass beautification call
- cache by normalized prompt

---

## 2. ResponseComposerAgent

### Responsibility

- accept compact tool facts
- merge them into one grounded Thai answer
- hide raw API shape / fragmented tool outputs from the user

### Input contract

```ts
interface ResponseComposerInput {
  route: string;
  userQuery: string;
  facts: Array<{
    source: string;
    summary: string;
    confidence?: number;
    metadata?: Record<string, unknown>;
  }>;
}
```

### Output contract

```ts
interface ResponseComposerOutput {
  text: string;
  mode: "deterministic" | "llm-fallback";
  reasons: string[];
}
```

### Execution policy

Run only when:
- more than one tool contributes to the answer
- tool returns raw/noisy payload that benefits from synthesis
- route already has rewrite behavior and should be centralized later

Do not run when:
- deterministic answer is already good enough
- one tool already returns polished text
- latency budget is nearly exhausted

---

## Routing Model

### Recommended request flow

1. raw user query arrives
2. deterministic gates still run first
3. if image gate matched → run `PromptAdapterAgent.adaptImagePrompt()`
4. if planner ambiguity → run `PromptAdapterAgent.normalizePlannerQuery()`
5. tool execution / API calls happen as usual
6. if route qualifies for composition → run `ResponseComposerAgent`
7. final answer returned in Thai

This keeps the current fast-path structure alive and inserts specialists only where they add value.

---

## Why this is better than 2 always-on agents

### Always-on version

- every query pays translation + analysis tax
- expensive on latency
- harder to reason about failures
- easy to create prompt-chaining regressions

### Gated specialist version

- image path improves immediately
- tool selection gets smarter only when needed
- synthesis is centralized without turning the whole app into an agent pipeline
- rollback is easier because each service is optional and isolated

---

## Rollout Plan

## Phase 6A — MVP Image Prompt Adapter

Goal:
- make Thai image prompts materially better without touching all routes

Tasks:
- create `src/services/promptAdapter.ts`
- wire image gates to use adapted English prompt
- keep original Thai prompt in structured content
- add focused tests

Success condition:
- prompts such as `สร้างรูปแมวสีแดงสไตล์การ์ตูน` no longer go into providers as near-raw Thai

## Phase 6B — Planner Normalization

Goal:
- improve tool selection quality for noisy Thai input

Tasks:
- feed normalized query into planner/tool selection where confidence is low
- keep raw query for logs/UI

Success condition:
- no measurable latency hit on ordinary deterministic routes

## Phase 6C — Response Composer Foundation

Goal:
- centralize final-answer synthesis as a reusable service

Tasks:
- create `responseComposer.ts`
- integrate with one route first
- keep contract compact and deterministic-first

Success condition:
- one high-value route gains cleaner final Thai answers without introducing a system-wide slowdown

## Phase 6D — Metrics and Guardrails

Goal:
- keep quality gains visible and regressions contained

Track:
- prompt adaptation mode
- prompt adaptation latency
- composer usage rate
- composer latency
- image prompt cache hit rate

---

## Concrete File Targets

### High-probability edits

- `innomcp-node/src/services/imageGenService.ts`
- `innomcp-node/src/routes/api/chat.ts`
- `innomcp-node/src/utils/mcp/answerPlanner.ts`
- `innomcp-node/src/services/promptAdapter.ts` (new)
- `innomcp-node/src/services/responseComposer.ts` (new)

### Existing utilities to reuse

- `innomcp-node/src/utils/thaiQueryNormalizer.ts`
- `innomcp-node/src/utils/languageValidator.ts`

### Suggested tests

- `innomcp-node/tests/unit/promptAdapter.test.ts`
- route-focused tests around image generation prompt adaptation
- composer unit tests with compact fact inputs

---

## Performance Guardrails

- deterministic path first, always
- no global LLM preprocessing for every query
- image prompt adapter fallback LLM only when confidence low
- response composer only on gated routes
- cache adapted prompts
- never chain translator → planner → composer → final LLM for simple chat

---

## Acceptance Criteria

1. Thai image prompts produce noticeably better English visual prompts before generation
2. user still talks Thai; system handles adaptation internally
3. tool selection benefits from normalization where needed
4. final answers from selected multi-tool routes are more coherent and complete
5. p50/p95 chat latency does not regress materially on non-image/general routes

---

## SA Verdict

`Yes, but only as gated specialists.`

ถ้าจะมี 2 agents ในระบบนี้ ควรเป็น:
- `PromptAdapterAgent` สำหรับ Thai → English visual prompt + planner normalization
- `ResponseComposerAgent` สำหรับ unified final Thai answer

ไม่ควรเป็น 2 agents ที่รันทุกข้อความตั้งแต่ต้นจนจบ เพราะนั่นคือทางที่ทำให้ระบบช้าแบบที่เคยเจอในช่วงแรกของโปรเจกต์
