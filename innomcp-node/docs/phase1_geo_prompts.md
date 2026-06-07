# Phase 1: GEO - Round B (Task Breakdown)

## 1. Task Distribution

### 🧠 Claude (Architect & Design)

- **Objective**: Create production-ready schema and code specifications.
- **Tasks**:
  1. Design `tables.sql` update for `knowledge_entities` (MariaDB JSON).
  2. Write `thai_geo_tool.ts` interface & logic (Mock/Stub).
  3. Write `tests/geo/thai_geo_tool.test.ts` (Comprehensive Test Plan).
  4. Create `seed_provinces.ts` script logic.

### ⚡ Vitcup (Implementer)

- **Objective**: Execute, verify, and fix.
- **Tasks**:
  1. Apply SQL changes to DB.
  2. Implement TypeScript files from Claude's design.
  3. Run Seed Script.
  4. Run Tests & Fix bugs.
  5. Verify latency < 200ms.

---

## 2. Claude Prompt (Copy & Paste to Claude)

```markdown
**Role**: Senior Database Architect & Typscript Lead
**Context**: INNOMCP Project - Phase 1 GEO (Thai Knowledge System)
**Database**: MariaDB 10.x (JSON Supported)

**Objective**:
Design the "Thai Knowledge System" to support `thai_geo_tool`. We need a single table `knowledge_entities` that stores generic knowledge, but we will focus ONLY on GEO data (Provinces) for now.

**Specs (Strict):**

1. **Schema (`knowledge_entities`)**:
   - `id` (VARCHAR 32, PK)
   - `domain` (VARCHAR 20, Index) -> 'geo'
   - `entity_type` (VARCHAR 32, Index) -> 'province' (New Requirement)
   - `name_th` (VARCHAR 255, Index, FullText) (Renamed from name)
   - `aliases` (JSON) -> ["โคราช", "นครราชสีมา"]
   - `description` (TEXT)
   - `attributes` (JSON) -> { "lat": ..., "lon": ..., "region": ... }
   - `confidence` (FLOAT)
   - `source` (JSON)

2. **Tool (`thai_geo_tool.ts`)**:
   - Input: `{ query: string, filter_region?: string, context?: object }`
   - Output: Standard MCP format (success, data, confidence).
   - Logic:
     - Query DB by `name_th` OR `aliases` (JSON_CONTAINS or LIKE).
     - Filter by `attributes.region` if provided.
     - Return strictly typed `ThaiGeoResult`.

3. **Test (`thai_geo_tool.test.ts`)**:
   - Test 1: "เชียงใหม่" -> Found, ID=PROV-50.
   - Test 2: "ภาคเหนือ" (filter) -> Returns multiple provinces.
   - Test 3: "มั่วซั่ว" -> success: false.
   - Test 4: Low confidence handling (Mock).

**Output Required**:

1. SQL for creating table (IF NOT EXISTS).
2. Full TypeScript code for `src/utils/mcp/tools/thai_geo_tool.ts`.
3. Full TypeScript code for `tests/geo/thai_geo_tool.test.ts`.
4. A small SEED ARRAY (JSON) for top 5 provinces (Bangkok, Chiang Mai, Khon Kaen, Phuket, Songkhla) for testing.
```

---

## 3. Vitcup Prompt (Copy & Paste to Vitcup)

```markdown
**Role**: Junior DevOps & Backend Developer
**Context**: You have received the design from Claude. Now IMPLEMENT it.

**Tasks**:

1. **Database Setup**:
   - Run the SQL to create `knowledge_entities`.
   - Check connection using `src/utils/db/db_connector.ts` (or existing pool).

2. **Code Implementation**:
   - Create `src/utils/mcp/tools/thai_geo_tool.ts` with the provided code.
   - Create `tests/geo/thai_geo_tool.test.ts`.
   - Register the tool in `src/utils/mcp/mcpclient.ts` (Local Tools section).

3. **Seeding**:
   - Create a temporary script `scripts/seed_geo_preview.ts`.
   - Insert the 5 sample provinces provided by Claude.
   - Run it: `npx ts-node scripts/seed_geo_preview.ts`.

4. **Verification**:
   - Run: `npx jest tests/geo/thai_geo_tool.test.ts`.
   - Run: `node -e "require('./src/utils/mcp/tools/thai_geo_tool').execute({query: 'เชียงใหม่'}).then(console.log)"` (Manual check).

**Report**:

- Paste the test results.
- Confirm latency is under 200ms.
```
