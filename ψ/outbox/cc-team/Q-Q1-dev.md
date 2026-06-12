<!-- cc-team deliverable
 group: Q (Remove @ts-nocheck from 6 services with proper TypeScript types)
 member: Q1 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":138,"completion_tokens":2998,"total_tokens":3136,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":176,"image_tokens":0},"cache_creation_input_tokens":0} | 57s
 generated: 2026-06-11T19:28:08.563Z -->
# Playbook: ลบ `// @ts-nocheck` อย่างปลอดภัย (ไม่เปลี่ยน Runtime)

## 1. หลักการสำคัญ

- **ห้ามเปลี่ยน runtime behavior**: ไม่เพิ่ม/ลบ/เปลี่ยน logic, ไม่เปลี่ยนลำดับการเรียก, ไม่เพิ่ม default value ที่ส่งผลต่อ output
- **Type-only changes เท่านั้น**: เพิ่ม type annotation, type assertion, type guard, `as const`, `satisfies` — ทุกอย่างที่ compile แล้วหายไป
- **Incremental**: เปิดทีละ error class, fix ทีละกลุ่ม, verify ด้วย `tsc --noEmit` ทุกครั้งก่อน commit

---

## 2. ขั้นตอนเปิด Type Checking แบบ Incremental

### 2.1 เตรียม environment

```bash
# ตรวจสอบ baseline ก่อนเริ่ม — ต้อง pass 100%
npx tsc --noEmit > baseline-errors.log
wc -l baseline-errors.log
```

### 2.2 ลบ pragma ทีละไฟล์

1. เปิดไฟล์ target (เช่น `providerManager.ts`)
2. **ลบบรรทัด** `// @ts-nocheck` (หรือ `// @ts-ignore` ที่หัวไฟล์)
3. รัน `npx tsc --noEmit 2>&1 | grep providerManager.ts | wc -l` เพื่อนับ error
4. ถ้า error > 50: ใช้ `--strict false` ชั่วคราวใน tsconfig.override.json แล้วค่อยๆ เปิด strict flags ทีละตัว

### 2.3 Strategy: Fix ตามลำดับ priority

| ลำดับ | Error class | เหตุผล |
|---|---|---|
| 1 | Missing return types | ง่ายสุด, ปลอดภัยสุด |
| 2 | Implicit `any` (parameters) | เพิ่ม annotation ตรงๆ |
| 3 | Implicit `any` (variables) | เพิ่ม annotation หรือ `as Type` |
| 4 | Possibly `undefined` / `null` | ใช้ type guard หรือ non-null assertion `!` (ระวัง) |
| 5 | Property does not exist | ขยาย interface หรือใช้ type assertion |
| 6 | Type mismatch | ใช้ `as` หรือปรับ interface |

---

## 3. Error Classes ที่พบบ่อย + Minimal Type-Only Fixes

### 3.1 Missing Return Type

**Error**: `TS7010: 'fnName', which lacks return-type annotation, implicitly has an 'any' return type.`

**Fix**: เพิ่ม return type ที่ชัดเจน

```ts
// ก่อน
function computeScore(input) {
  return input * 2;
}

// หลัง (type-only)
function computeScore(input: number): number {
  return input * 2;
}
```

**สำหรับ async**: ใช้ `Promise<T>`

```ts
async function fetchProvider(id: string): Promise<Provider> { ... }
```

**สำหรับ void**: ใช้ `void` เมื่อไม่ return ค่า

```ts
function warmup(): void { ... }
```

### 3.2 Implicit `any` — Parameters

**Error**: `TS7006: Parameter 'x' implicitly has an 'any' type.`

**Fix**:

```ts
// ก่อน
const handler = (req, res) => { ... };

// หลัง
const handler = (req: Request, res: Response): void => { ... };
```

**เมื่อไม่รู้ type จริง**: ใช้ `unknown` แทน `any` แล้ว narrow ทีหลัง (ปลอดภัยกว่า)

```ts
const parse = (data: unknown): Parsed => {
  if (isParsed(data)) return data;
  throw new Error('invalid');
};
```

### 3.3 Implicit `any` — Variables

**Error**: `TS7005: Variable 'x' implicitly has an 'any' type.`

**Fix**:

```ts
// ก่อน
let result;
result = compute();

// หลัง
let result: ComputeResult;
result = compute();
```

**สำหรับ array/object literals**:

```ts
// ก่อน
const items = [];
items.push({ id: 1 });

// หลัง
const items: Item[] = [];
items.push({ id: 1 });
```

### 3.4 Possibly `undefined` / `null`

**Error**: `TS2532: Object is possibly 'undefined'.`

**Fix options (เลือกตามบริบท)**:

**A. Type guard (ปลอดภัยสุด)**:
```ts
if (provider !== undefined) {
  provider.activate();
}
```

**B. Optional chaining (ถ้าแค่ read)**:
```ts
const name = provider?.name;
```

**C. Non-null assertion `!` (ใช้เมื่อมั่นใจ 100% ว่ามีค่า)**:
```ts
// ใช้เมื่อ logic ก่อนหน้าการันตีแล้ว แต่ TS ไม่รู้
const config = getConfig(); // การันตีว่าไม่ null
config!.port = 3000;
```

**⚠️ ห้ามใช้ `!` มั่ว** — ถ้าผิดจะเกิด runtime error

**D. Default value (ระวัง: อาจเปลี่ยน runtime)**:
```ts
// ❌ เปลี่ยน runtime ถ้าเดิม undefined ถูก pass ต่อ
const port = config.port ?? 3000;

// ✅ ปลอดภัยถ้าใช้แค่ภายใน function และไม่ export ค่านี้
const localPort: number = config.port ?? 3000;
```

### 3.5 Property Does Not Exist

**Error**: `TS2339: Property 'x' does not exist on type 'Y'.`

**Fix**:

**A. ขยาย interface**:
```ts
interface Provider {
  id: string;
  metadata?: Record<string, unknown>; // เพิ่ม
}
```

**B. Type assertion (เมื่อรู้ว่าเป็น subtype)**:
```ts
const enhanced = provider as EnhancedProvider;
enhanced.specialMethod();
```

**C. Index signature (สำหรับ dynamic objects)**:
```ts
const tools: Record<string, Tool> = {};
tools['thai-id-validator'] = validator;
```

### 3.6 Type Mismatch

**Error**: `TS2322: Type 'X' is not assignable to type 'Y'.`

**Fix**:

```ts
// ใช้ `as` เมื่อมั่นใจ
return result as ExpectedType;

// ใช้ `satisfies` เพื่อ validate โดยไม่ widen type (TS 4.9+)
const config = { port: 3000 } satisfies Config;
```

---

## 4. Verification ด้วย `tsc --noEmit`

### 4.1 Command หลัก

```bash
# Check ทั้ง project
npx tsc --noEmit

# Check เฉพาะไฟล์ที่แก้ (ใช้กับ --listFiles เพื่อดู)
npx tsc --noEmit --listFiles | grep providerManager

# ดู error เฉพาะไฟล์
npx tsc --noEmit 2>&1 | grep -E "(providerManager|thaiGovtTools|thaiIntentRouter|workspaceService|wsEnhancer|warmup)\.ts"
```

### 4.2 Verification checklist

- [ ] `tsc --noEmit` exit code = 0
- [ ] ไม่มี error ใหม่ในไฟล์อื่น (regression)
- [ ] รัน unit tests ที่เกี่ยวกับไฟล์: `npm test -- providerManager`
- [ ] รัน integration test / smoke test ถ้ามี
- [ ] เปรียบเทียบ runtime output ก่อน/หลัง (ถ้ามี deterministic output)

### 4.3 Regression check

```bash
# ก่อนแก้
npx tsc --noEmit > before.log

# หลังแก้
npx tsc --noEmit > after.log

# เ���รียบเทียบ — ต้องไม่มี error ใหม่ในไฟล์อื่น
diff before.log after.log | grep "^>" | grep -v "providerManager\|thaiGovtTools\|thaiIntentRouter\|workspaceService\|wsEnhancer\|warmup"
```

---

## 5. Reusable Checklist ต่อไฟล์

ใช้ checklist นี้กับทุกไฟล์ใน target list:

### Phase 1: Preparation

- [ ] `git status` — working tree clean
- [ ] `git checkout -b chore/remove-ts-nocheck-<filename>`
- [ ] `npx tsc --noEmit > baseline.log` — baseline pass
- [ ] รัน tests ที่เกี่ยวกับไฟล์ — ต้อง pass
- [ ] บันทึก runtime output sample (ถ้ามี)

### Phase 2: Remove pragma

- [ ] ลบบรรทัด `// @ts-nocheck` ออกจากไฟล์
- [ ] `npx tsc --noEmit 2>&1 | grep <filename> | wc -l` — นับ errors
- [ ] ถ้า errors > 100: พิจารณาแบ่งเป็น sub-tasks

### Phase 3: Fix errors (ตาม priority)

- [ ] **Return types**: เพิ่ม return type ทุก function
- [ ] **Parameter types**: เพิ่ม type ทุก parameter
- [ ] **Variable types**: เพิ่ม type ทุก `let`/`const` ที่ implicit any
- [ ] **Null/undefined**: ใช้ type guard ห���ือ `!` (อย่างระมัดระวัง)
- [ ] **Property access**: ขยาย interface หรือใช้ assertion
- [ ] **Type mismatch**: ใช้ `as` หรือ `satisfies`

### Phase 4: Verify

- [ ] `npx tsc --noEmit` — exit 0
- [ ] `diff baseline.log current.log` — ไม่มี regression ในไฟล์อื่น
- [ ] รัน unit tests — pass
- [ ] รัน integration tests — pass
- [ ] เปรียบเทียบ runtime output (ถ้ามี) — เหมือนเดิม

### Phase 5: Commit

- [ ] `git add <filename>.ts`
- [ ] `git commit -m "refactor(<filename>): remove @ts-nocheck, add type annotations"`
- [ ] `git push` + เปิด PR
- [ ] ขอ review จาก teammate ที่คุ้นเคยไฟล์นี้

---

## 6. Notes เฉพาะ Target Files

### `providerManager.ts`
- **คาดว่าจะเจอ**: interface ของ Provider, return types ของ async functions, dynamic provider registry
- **Strategy**: นิยาม `Provider` interface ให้ชัด, ใช้ `Map<string, Provider>` แทน object literal, return type `Promise<Provider>` ทุก async

### `thaiGovtTools.ts`
- **คาดว่าจะเจอ**: tool definitions, parameter schemas, possibly-undefined จาก API responses
- **Strategy**: ใช้ type guard สำหรับ API responses, นิยาม tool parameter types, ใช้ `Record<string, Tool>` สำหรับ registry

### `thaiIntentRouter.ts`
- **คาดว่าจะเจอ**: intent matching logic, dynamic routing, union types ของ intents
- **Strategy**: นิยาม `Intent` union type, ใช้ discriminated union + type guard, return type `Promise<RouteResult>`

### `workspaceService.ts`
- **คาดว่าจะเจอ**: workspace state, async operations, possibly-null workspace
- **Strategy**: ใช้ type guard สำหรับ workspace existence, นิยาม `Workspace` interface, return types ชัดเจน

### `wsEnhancer.ts`
- **คาดว่าจะเจอ**: WebSocket types, event handlers, dynamic message parsing
- **Strategy**: ใช้ `WebSocket` type จาก `ws` หรือ `@types/ws`, นิยาม message types, ใช้ type guard สำหรับ parsed messages

### `warmup.ts`
- **คาดว่าจะเจอ**: initialization logic, async warmup functions, void returns
- **Strategy**: return type `Promise<void>` หรือ `void`, parameter types สำหรับ config, ใช้ type guard สำหรับ optional config

---

## 7. Anti-patterns ที่ต้องหลีกเลี่ยง

| ❌ ห้ามทำ | ✅ ทำแทน |
|---|---|
| `// @ts-ignore` บรรทัดเดียว | Fix type ให้ถูก |
| `as any` | `as SpecificType` หรือ `unknown` + narrow |
| เปลี่ยน default value | เพิ่ม type annotation |
| เพิ่ม `if (x) return` ใหม่ | ใช้ type guard ที่ไม่เปลี่ยน flow |
| ลบ code ที่ "ดูไม่ใช้" | เก็บไว้, เพิ่ม type |
| `!` ทุกที่ | `!` เฉพาะที่การันตีได้ |

---

## 8. Rollback Plan

ถ้าเจอปัญหาหลัง merge:

```bash
git revert <commit-hash>
# หรือ
git checkout main -- <filename>.ts
# แล้วเพิ่ม // @ts-nocheck กลับคืนชั่วคราว
```

---

## 9. Definition of Done

ไฟล์ถือว่า "done" เมื่อ:

1. ✅ ไม่มี `// @ts-nocheck` ที่หัวไฟล์
2. ✅ `tsc --noEmit` pass
3. ✅ ไม่มี `as any` (ยกเว้นมี justification ใน comment)
4. ✅ ทุก function มี return type
5. ✅ ทุก parameter มี type
6. ✅ Tests pass
7. ✅ Runtime behavior ไม่เปลี่ยน (verified)
8. ✅ PR reviewed + merged

---

**เริ่มเลย**: เลือกไฟล์ที่เล็กสุดก่อน (แนะนำ `warmup.ts` หรือ `wsEnhancer.ts`) เพื่อสร้าง momentum แล้วค่อยไปไฟล์ใหญ่ (`providerManager.ts`, `workspaceService.ts`)
