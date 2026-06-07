# Phase 2 Implementation Guide — Thai History Tool

**Author**: Claude (Senior Architect)
**For**: Vitcup (Junior Dev)
**Date**: 2026-02-09

---

## Overview

The architecture, types, and tests are already in place. Your job is to:
1. Add **person** and **event** seed data to `THAI_HISTORY_SEED`
2. Migrate attributes to use the **discriminated union** types
3. Make all 21 tests pass

The existing tool (`thaiHistoryTool.ts`) already handles eras and basic events.
You need to expand the data and refine the attribute types.

---

## Step 1: Understand the Existing Code

Read these files first:

| File | Purpose |
|------|---------|
| `src/mcp/tools/thaiHistoryTool.ts` | Current tool — **you will modify this** |
| `src/mcp/tools/thaiGeoTool.ts` | Reference pattern (geo equivalent) |
| `src/mcp/knowledge/types/history.ts` | **New canonical types** (your target) |
| `tests/mcp/thai_history_tool.spec.ts` | **Test suite** — run after every change |
| `docs/phases/phase2-history/PHASE2_SPEC.md` | Specification |
| `docs/phases/phase2-history/DOD.md` | Definition of Done |

---

## Step 2: Migrate `ThaiHistoryAttributes` to Discriminated Union

Currently `thaiHistoryTool.ts` uses a flat attributes type:

```ts
// CURRENT (flat — no entity_type discriminator)
interface ThaiHistoryAttributes {
  era: string;
  period?: string;
  year_start?: number;
  year_end?: number;
  event_type: string;
  key_figures?: string[];
}
```

Replace it by importing from the canonical types file:

```ts
// NEW — import from knowledge types
import type { HistoryAttributes, HistoryEra, HistoryPerson, HistoryEvent } from "../knowledge/types/history";
```

Then update `ThaiHistoryEntity` to use `HistoryAttributes`:

```ts
export interface ThaiHistoryEntity {
  // ... same fields ...
  attributes: HistoryAttributes;  // <-- was ThaiHistoryAttributes
}
```

Update `ThaiHistoryResult` similarly.

### Scoring: Handle `entity_type`

The `InMemoryHistoryDb.score()` method currently checks `attrs.era`. After migration, you need to handle each entity type:

```ts
private score(entity: ThaiHistoryEntity, q: string): number {
  const aliases = entity.aliases ?? [];
  const attrs = entity.attributes;

  if (entity.name_th.toLowerCase() === q) return 0.95;
  if (aliases.some(a => a.toLowerCase() === q)) return 0.92;
  if (entity.name_th.toLowerCase().includes(q)) return 0.85;
  if (aliases.some(a => a.toLowerCase().includes(q))) return 0.82;

  // Type-specific matching
  if (attrs.entity_type === "era" && attrs.period?.toLowerCase().includes(q)) return 0.8;
  if (attrs.entity_type === "person" && attrs.significance?.toLowerCase().includes(q)) return 0.78;
  if (attrs.entity_type === "event" && attrs.significance?.toLowerCase().includes(q)) return 0.78;

  if (entity.description.toLowerCase().includes(q)) return 0.75;
  return 0;
}
```

### normalizeDbRowToEntity: Handle discriminated union

When parsing DB rows, you need to preserve the `entity_type` field:

```ts
function normalizeDbRowToEntity(row: any): ThaiHistoryEntity {
  // ... existing parsing ...
  const attributes = safeJsonParse<any>(row.attributes, {});

  // Preserve entity_type for discriminated union
  return {
    // ... existing fields ...
    attributes: {
      entity_type: attributes.entity_type ?? "era",  // <-- ADD THIS
      ...attributes,
    } as HistoryAttributes,
  };
}
```

---

## Step 3: Add Person Seed Data

Add these entities to `THAI_HISTORY_SEED` in `thaiHistoryTool.ts`.
The tests expect **at least 5 monarchs** with `entity_type: "person"`.

### Required Persons (from DoD: at least 10 monarchs)

```ts
// Person: King Naresuan
{
  id: "person:naresuan",
  domain: "history",
  name_th: "สมเด็จพระนเรศวรมหาราช",
  aliases: ["พระนเรศวร", "พระองค์ดำ", "Naresuan", "Naresuan the Great", "King Naresuan"],
  description: "กษัตริย์ผู้ประกาศอิสรภาพจากพม่า ทรงทำยุทธหัตถีชนะพระมหาอุปราชา",
  attributes: {
    entity_type: "person",
    era: "history:ayutthaya",
    role: "King",
    reign_period: "พ.ศ. 2133–2148",
    year_birth: 1555,
    year_death: 1605,
    significance: "ประกาศอิสรภาพจากพม่า ยุทธหัตถี",
    titles: ["สมเด็จพระนเรศวรมหาราช", "สมเด็จพระสรรเพ็ชญ์ที่ 2"],
  },
  relations: [{ type: "ruled_during", target_id: "history:ayutthaya" }],
  source: RTGG_SOURCE,
  confidence: 0.95,
  version: "1.0.0",
  updated_at: now,
},

// Person: King Ramkhamhaeng
{
  id: "person:ramkhamhaeng",
  domain: "history",
  name_th: "พ่อขุนรามคำแหงมหาราช",
  aliases: ["พ่อขุนรามคำแหง", "รามคำแหง", "Ramkhamhaeng"],
  description: "กษัตริย์สุโขทัยผู้ประดิษฐ์อักษรไทย ทรงปกครองอาณาจักรให้รุ่งเรืองสูงสุด",
  attributes: {
    entity_type: "person",
    era: "history:sukhothai",
    role: "King",
    reign_period: "พ.ศ. 1822–1841",
    significance: "ประดิษฐ์อักษรไทย ขยายอาณาเขตสุโขทัย",
    titles: ["พ่อขุนรามคำแหงมหาราช"],
  },
  relations: [{ type: "ruled_during", target_id: "history:sukhothai" }],
  source: RTGG_SOURCE,
  confidence: 0.95,
  version: "1.0.0",
  updated_at: now,
},

// Person: King Taksin
{
  id: "person:taksin",
  domain: "history",
  name_th: "สมเด็จพระเจ้าตากสินมหาราช",
  aliases: ["พระเจ้าตากสิน", "ตากสิน", "Taksin"],
  description: "กษัตริย์ผู้กอบกู้เอกราชหลังเสียกรุงศรีอยุธยาครั้งที่ 2 สถาปนากรุงธนบุรี",
  attributes: {
    entity_type: "person",
    era: "history:thonburi",
    role: "King",
    reign_period: "พ.ศ. 2310–2325",
    year_birth: 1734,
    year_death: 1782,
    significance: "กอบกู้เอกราช สถาปนากรุงธนบุรี",
    titles: ["สมเด็จพระเจ้าตากสินมหาราช"],
  },
  relations: [{ type: "ruled_during", target_id: "history:thonburi" }],
  source: RTGG_SOURCE,
  confidence: 0.95,
  version: "1.0.0",
  updated_at: now,
},

// Person: King Chulalongkorn (Rama V)
{
  id: "person:chulalongkorn",
  domain: "history",
  name_th: "พระบาทสมเด็จพระจุลจอมเกล้าเจ้าอยู่หัว",
  aliases: ["จุฬาลงกรณ์", "รัชกาลที่ 5", "Chulalongkorn", "Rama V"],
  description: "กษัตริย์ผู้ทรงพระปรีชาสามารถ ทรงเลิกทาส ปฏิรูปการปกครอง รักษาเอกราชจากลัทธิล่าอาณานิคม",
  attributes: {
    entity_type: "person",
    era: "history:rattanakosin",
    role: "King",
    reign_period: "พ.ศ. 2411–2453",
    year_birth: 1853,
    year_death: 1910,
    significance: "เลิกทาส ปฏิรูปประเทศ รักษาเอกราช",
    titles: ["พระบาทสมเด็จพระจุลจอมเกล้าเจ้าอยู่หัว", "พระปิยมหาราช"],
  },
  relations: [{ type: "ruled_during", target_id: "history:rattanakosin" }],
  source: RTGG_SOURCE,
  confidence: 0.95,
  version: "1.0.0",
  updated_at: now,
},
```

### Additional Monarchs to Add (DoD requires >= 10)

Add at least 6 more to reach the DoD minimum of 10:

| id | name_th | Era | Notes |
|----|---------|-----|-------|
| `person:sriindraditya` | พ่อขุนศรีอินทราทิตย์ | Sukhothai | Founder |
| `person:borommatrailokanat` | สมเด็จพระบรมไตรโลกนาถ | Ayutthaya | Legal reformer |
| `person:rama1` | พระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลกมหาราช | Rattanakosin | Founder |
| `person:mongkut` | พระบาทสมเด็จพระจอมเกล้าเจ้าอยู่หัว (Rama IV) | Rattanakosin | Modernizer |
| `person:sunthorn-phu` | สุนทรภู่ | Rattanakosin | Poet (role: "Poet") |
| `person:vajiravudh` | พระบาทสมเด็จพระมงกุฎเกล้าเจ้าอยู่หัว (Rama VI) | Rattanakosin | Education reforms |

---

## Step 4: Add Event Seed Data

The tests expect these events:

```ts
// Event: Fall of Ayutthaya 2
{
  id: "event:fall-ayutthaya-2",
  domain: "history",
  name_th: "เสียกรุงศรีอยุธยาครั้งที่ 2",
  aliases: ["เสียกรุงครั้งที่ 2", "Fall of Ayutthaya 1767"],
  description: "พม่าตีกรุงศรีอยุธยาแตก พ.ศ. 2310 สิ้นสุดอาณาจักรอยุธยา 417 ปี",
  attributes: {
    entity_type: "event",
    era: "history:ayutthaya",
    year: 1767,
    date: "7 เมษายน พ.ศ. 2310",
    event_type: "battle",
    key_figures: ["พระเจ้ามังระ", "สมเด็จพระที่นั่งสุริยาศน์อมรินทร์"],
    outcome: "กรุงศรีอยุธยาแตก",
    significance: "สิ้นสุดอาณาจักรอยุธยา นำไปสู่การสถาปนากรุงธนบุรี",
  },
  relations: [{ type: "ended", target_id: "history:ayutthaya" }],
  source: RTGG_SOURCE,
  confidence: 0.95,
  version: "1.0.0",
  updated_at: now,
},

// Event: Bowring Treaty
{
  id: "event:bowring-treaty",
  domain: "history",
  name_th: "สนธิสัญญาเบาว์ริง",
  aliases: ["Bowring Treaty", "สนธิสัญญาทางไมตรีและการค้า"],
  description: "สนธิสัญญาการค้าเสรีระหว่างสยามกับอังกฤษ ลงนาม พ.ศ. 2398",
  attributes: {
    entity_type: "event",
    era: "history:rattanakosin",
    year: 1855,
    event_type: "treaty",
    key_figures: ["พระบาทสมเด็จพระจอมเกล้าเจ้าอยู่หัว", "Sir John Bowring"],
    outcome: "เปิดการค้าเสรี ยกเลิกระบบผูกขาด",
    significance: "จุดเปลี่ยนเศรษฐกิจสยามสู่ตลาดโลก",
  },
  relations: [],
  source: RTGG_SOURCE,
  confidence: 0.95,
  version: "1.0.0",
  updated_at: now,
},
```

### Also migrate existing Siamese Revolution 1932 entry

Update the existing `history:siamese-revolution-1932` entry to use the new event type:

```ts
// BEFORE:
attributes: { era: "รัตนโกสินทร์", period: "24 มิถุนายน พ.ศ. 2475", year_start: 1932, year_end: 1932, event_type: "revolution", key_figures: [...] }

// AFTER:
attributes: {
  entity_type: "event",
  era: "history:rattanakosin",
  year: 1932,
  date: "24 มิถุนายน พ.ศ. 2475",
  event_type: "revolution",
  key_figures: ["พระยาพหลพลพยุหเสนา", "ปรีดี พนมยงค์"],
  outcome: "เปลี่ยนการปกครองเป็นระบอบประชาธิปไตย",
  significance: "สิ้นสุดระบอบสมบูรณาญาสิทธิราชย์",
}
```

### Migrate existing era entries

Add `entity_type: "era"` to all 4 kingdom entries (Sukhothai, Ayutthaya, Thonburi, Rattanakosin):

```ts
// BEFORE:
attributes: { era: "สุโขทัย", period: "พ.ศ. 1792–1981", year_start: 1249, year_end: 1438, event_type: "kingdom", key_figures: [...] }

// AFTER:
attributes: {
  entity_type: "era",
  capital: "สุโขทัย",
  year_start: 1249,
  year_end: 1438,
  period: "พ.ศ. 1792–1981",
  key_figures: ["พ่อขุนศรีอินทราทิตย์", "พ่อขุนรามคำแหง"],
  successor_era: "history:ayutthaya",
}
```

---

## Step 5: Update `entityToResult()` and `computeConfidence()`

The `entityToResult()` function hardcodes the flat attribute shape. Update it to pass through the discriminated union:

```ts
function entityToResult(entity: ThaiHistoryEntity): ThaiHistoryResult {
  return {
    id: entity.id,
    name_th: entity.name_th,
    aliases: entity.aliases ?? [],
    description: entity.description,
    attributes: entity.attributes,  // pass through as-is
  };
}
```

---

## Step 6: Run Tests

```bash
npx tsx --test tests/mcp/thai_history_tool.spec.ts
```

### Expected progression:

| After Step | Pass | Fail |
|-----------|------|------|
| Before you start | 14 | 7 |
| After adding person seed | 19 | 2 |
| After adding event seed | 21 | 0 |

---

## Step 7: Register in `godTierRouter` (if applicable)

The `godTierRouter` in `innomcp-node/src/utils/mcp/godTierRouter.ts` uses keyword-based routing.
Add a "history" category if it doesn't exist:

```ts
// In the CATEGORIES array, ensure "history" is present
// In KEYWORD_SEEDS, add Thai history keywords:
"history": ["ประวัติศาสตร์", "ยุคสมัย", "กษัตริย์", "เหตุการณ์", "สุโขทัย", "อยุธยา", "ธนบุรี", "รัตนโกสินทร์"]
```

---

## Step 8: Verify Registration in `server.ts`

The tool is already registered in `server.ts` via `registerThaiHistoryTool(mcpserver)`.
No changes needed here unless you rename the function.

---

## Checklist (DoD)

- [ ] `entity_type` discriminator added to all seed entries
- [ ] 4 Major Eras with `entity_type: "era"` (Sukhothai, Ayutthaya, Thonburi, Rattanakosin)
- [ ] >= 10 Monarchs with `entity_type: "person"`
- [ ] >= 2 Events with `entity_type: "event"` (Fall of Ayutthaya 2, Bowring Treaty)
- [ ] `ThaiHistoryAttributes` replaced with `HistoryAttributes` from `knowledge/types/history.ts`
- [ ] `InMemoryHistoryDb.score()` handles all 3 entity types
- [ ] `normalizeDbRowToEntity()` preserves `entity_type`
- [ ] All 21 tests pass: `npx tsx --test tests/mcp/thai_history_tool.spec.ts`
- [ ] Static lookup < 500ms
- [ ] `confidence < 0.6` for unknown queries (anti-hallucination)

---

## File Map

```
innomcp-server-node/
├── src/mcp/
│   ├── knowledge/types/
│   │   └── history.ts          ← NEW: canonical type definitions (DO NOT MODIFY)
│   └── tools/
│       └── thaiHistoryTool.ts  ← MODIFY: add seed data + migrate types
├── tests/mcp/
│   └── thai_history_tool.spec.ts  ← NEW: test suite (DO NOT MODIFY)
└── docs/phases/phase2-history/
    ├── PHASE2_SPEC.md
    ├── DOD.md
    └── impl_guide.md           ← THIS FILE
```
